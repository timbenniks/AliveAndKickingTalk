import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { nextTick } from 'vue';
import { spectrum } from './guitar-signal.mjs';

// Import the browser engine directly: no Nuxt setup or fake Vue lifecycle.
// Only browser audio devices/clocks are faked; no microphone is opened.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('#shared/')) {
      return nextResolve(new URL(`../shared/${specifier.slice(8)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});
let renderFrame;
let wall = 1000;
let frozenAudioTime = null;
let activeContext;
let nextTimer = 0;
const timers = new Map();
function advance(milliseconds, draw = true) {
  const end = wall + milliseconds;
  while (true) {
    const entry = [...timers.entries()].sort((a, b) => a[1].due - b[1].due)[0];
    if (!entry || entry[1].due > end + 1e-8) break;
    wall = entry[1].due;
    entry[1].due += entry[1].interval;
    entry[1].callback();
  }
  wall = end;
  if (draw) renderFrame();
}
Object.assign(globalThis, {
  requestAnimationFrame: callback => { renderFrame = callback; return 1; },
  cancelAnimationFrame: () => {},
  performance: { now: () => wall },
  setInterval: (callback, interval) => {
    const id = ++nextTimer;
    timers.set(id, { callback, interval, due: wall + interval });
    return id;
  },
  clearInterval: id => timers.delete(id),
  localStorage: { getItem: key => key === 'alive-lane-source' ? 'midi' : null, setItem: () => {} },
});

const requests = [];
const connected = [];
let guitarAnalyser;
let inputDb = -72;
let inputPeaks = [7];
let polyInput = new Float32Array(2048).fill(-Infinity);
let polyReads = 0;
class FakeAudioContext {
  constructor() { activeContext = this; }
  get currentTime() { return frozenAudioTime ?? wall / 1000; }
  state = 'running';
  sampleRate = 48000;
  createMediaStreamSource(stream) {
    connected.push(stream);
    return { connect() {}, disconnect() {} };
  }
  createAnalyser() {
    guitarAnalyser = {
      frequencyBinCount: 2048, connect() {}, disconnect() {},
      getFloatFrequencyData(data) { polyReads++; data.set(polyInput); },
      getByteFrequencyData(data) {
        data.fill(0);
        // Simulate note/chord peaks using the analyser's configured dB window.
        for (const bin of inputPeaks) {
          data[bin] = Math.max(0, Math.min(255, Math.round(
            255 * (inputDb - this.minDecibels) / (this.maxDecibels - this.minDecibels),
          )));
        }
      },
    };
    return guitarAnalyser;
  }
  async close() { this.state = 'closed'; }
}
globalThis.AudioContext = FakeAudioContext;
globalThis.window = { AudioContext: FakeAudioContext };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
  mediaDevices: {
    getUserMedia: () => new Promise((resolve, reject) => { requests.push({ resolve, reject }); }),
    enumerateDevices: async () => [],
  },
} });

function stream(id) {
  const track = { stopped: false, label: id, stop() { this.stopped = true; }, getSettings: () => ({ deviceId: id }) };
  return { track, getTracks: () => [track], getAudioTracks: () => [track] };
}

const { createStageAudio } = await import('../app/utils/stage-audio.ts');
const audio = createStageAudio();
const otherAudio = createStageAudio();
otherAudio.guitarGateDb.value = -30;
assert.equal(audio.guitarGateDb.value, -65, 'audio state is isolated between Nuxt app instances');
otherAudio.dispose();
audio.acquire();
assert.equal(audio.laneSource.value, 'song', 'retired MIDI source falls back to track');
assert.equal(requests.length, 0, 'retired source does not open a microphone');

// Exercise the real audio tick at different rates, with no sound or devices.
const { stageClock } = await import('../shared/stage/clock.ts');
for (const hz of [30, 60, 120, 144]) {
  advance(1000);
  stageClock.bass = stageClock.mid = stageClock.treble = stageClock.energy = 1;
  stageClock.lanes.fill(1);
  for (let frame = 0; frame < hz; frame++) { advance(1000 / hz); }
  for (const value of [stageClock.bass, stageClock.mid, stageClock.treble, stageClock.energy]) {
    assert.ok(Math.abs(value - Math.pow(0.82, 60)) < 1e-12);
  }
  assert.ok(stageClock.lanes.every(value => Math.abs(value - Math.pow(0.8, 60)) < 1e-12));
}

// Switching away while permission is pending must stop the returned stream.
audio.setLaneSource('guitar');
const switching = audio.startGuitar();
audio.setLaneSource('song');
const obsolete = stream('obsolete');
requests.shift().resolve(obsolete);
await switching;
assert.equal(obsolete.track.stopped, true);
assert.equal(connected.length, 0);
assert.equal(audio.guitarStatus.value, 'Guitar input is off');

// A newer device wins even if the old permission request resolves last.
audio.setLaneSource('guitar');
const first = audio.startGuitar('first');
const oldRequest = requests.shift();
const second = audio.startGuitar('second');
const current = stream('second');
requests.shift().resolve(current);
await second;
const old = stream('first');
oldRequest.resolve(old);
await first;
assert.equal(old.track.stopped, true);
assert.equal(current.track.stopped, false);
assert.equal(audio.guitarDeviceId.value, 'second');
assert.deepEqual(connected, [current]);

// A stale rejection must not stop or overwrite a successful newer input.
const failing = audio.startGuitar('failing');
assert.equal(current.track.stopped, true);
const staleFailure = requests.shift();
const latestStart = audio.startGuitar('latest');
const latest = stream('latest');
requests.shift().resolve(latest);
await latestStart;
staleFailure.reject(Error('permission denied'));
await failing;
assert.equal(latest.track.stopped, false);
assert.equal(audio.guitarStatus.value, 'Listening to latest');

// Quiet single notes trigger without song playback; noise and sustain do not flood.
assert.equal(guitarAnalyser.minDecibels, -75);
assert.equal(guitarAnalyser.maxDecibels, -25);
stageClock.events.length = 0;
for (let frame = 0; frame < 30; frame++) { advance(1000 / 60); }
assert.equal(stageClock.events.length, 0);
inputDb = -62;
advance(1000 / 60);
assert.equal(stageClock.events.length, 1);
assert.equal(stageClock.events[0].lane, 0);
stageClock.events.length = 0;
for (let frame = 0; frame < 30; frame++) { advance(1000 / 60); }
// The existing detector can emit another pulse during the attack, then settles.
assert.ok(stageClock.events.length <= 1);
stageClock.events.length = 0;
for (let frame = 0; frame < 30; frame++) { advance(1000 / 60); }
assert.equal(stageClock.events.length, 0);
inputDb = -72;
for (let frame = 0; frame < 30; frame++) { advance(1000 / 60); }
inputDb = -62;
advance(1000 / 60);
assert.equal(stageClock.events.length, 1);

// A strummed E-major spectrum (fundamentals plus harmonics) must light several
// lanes immediately, without requiring one stable fundamental. Test the actual
// tick at ordinary and high display refresh rates, including release/re-strum.
inputPeaks = [82.41, 123.47, 164.81, 207.65, 246.94, 329.63, 494, 659, 989]
  .map(hz => Math.round(hz / (48000 / 4096)));
for (const refreshRate of [30, 60, 120, 144]) {
  for (let strum = 0; strum < 2; strum++) {
    inputDb = -72;
    for (let frame = 0; frame < refreshRate / 2; frame++) { advance(1000 / refreshRate); }
    stageClock.events.length = 0;
    inputDb = -50;
    advance(1000 / refreshRate);
    assert.equal(stageClock.events.length, 3, 'a chord produces the three strongest lane pulses');
    assert.equal(new Set(stageClock.events.map(event => event.lane)).size, 3);
    assert.ok(stageClock.lanes.every(level => level > 0.2), 'all six spectrum zones respond');
    for (let frame = 0; frame < refreshRate; frame++) { advance(1000 / refreshRate); }
    stageClock.events.length = 0;
    for (let frame = 0; frame < refreshRate / 2; frame++) { advance(1000 / refreshRate); }
    assert.equal(stageClock.events.length, 0, 'a held chord settles without flooding gems');
  }
}

// The experimental polyphonic path drives all six lanes without sending guitar
// audio to speakers, and analyses at 60 Hz independently of display refresh.
for (const refreshRate of [30, 60, 120, 144]) {
  audio.setGuitarMode('polyphonic');
  assert.equal(guitarAnalyser.smoothingTimeConstant, 0);
  stageClock.events.length = 0;
  polyInput = spectrum([40, 47, 52, 56, 59, 64]);
  const before = polyReads;
  for (let frame = 0; frame < refreshRate; frame++) { advance(1000 / refreshRate); }
  assert.ok(polyReads - before >= 59 && polyReads - before <= 61, '60 Hz analysis is independent of display refresh');
  assert.equal(stageClock.events.length, 6, 'six chord voices produce six attacks');
  assert.deepEqual(stageClock.events.map(hit => hit.lane).toSorted(), [0, 1, 2, 3, 4, 5]);
  assert.ok(stageClock.lanes.every(level => level > 0));
  assert.match(audio.guitarNotes.value, /E2/);
  assert.ok(audio.guitarInputDb.value > audio.guitarGateDb.value, 'debug exposes signal level above the gate');
  polyInput.fill(-Infinity);
  for (let frame = 0; frame < refreshRate / 3; frame++) { advance(1000 / refreshRate); }
  assert.ok(stageClock.lanes.every(level => level === 0), 'released chord clears all lanes');
  assert.equal(audio.guitarInputDb.value, -120, 'silence is visible below the gate');
}
// Detection continues without drawing; suspended or unchanged audio cannot
// produce duplicate observations. A long rendering pause cannot grow the queue.
audio.setGuitarMode('polyphonic');
polyInput = spectrum([40, 47, 52, 56, 59, 64]);
advance(200, false);
assert.equal(stageClock.events.length, 6, 'analysis does not wait for requestAnimationFrame');
let beforePause = polyReads;
frozenAudioTime = wall / 1000;
advance(1000, false);
assert.ok(polyReads - beforePause <= 1, 'unchanged audio time is read at most once');
activeContext.state = 'suspended';
beforePause = polyReads;
advance(1000, false);
assert.equal(polyReads, beforePause, 'suspended audio is not analysed');
activeContext.state = 'running';
frozenAudioTime = null;
for (let beat = 0; beat < 24; beat++) {
  polyInput = spectrum([40, 47, 52, 56, 59, 64], { amplitude: beat % 2 ? 0.08 : 0.001 });
  advance(200, false);
}
assert.ok(stageClock.events.length <= 64, 'analysis bounds events even without drawing');
assert.equal(timers.size, 1, 'only one guitar analysis timer is live');
audio.setGuitarMode('polyphonic');

// Octave filtering is wired through the real input tick, not only the helper.
polyInput = spectrum([52], { harmonicGains: [1, 2, 1, 1.6, 1, 1.2, 1, 1, 1, 1] });
audio.guitarOctaveRatio.value = 0;
await nextTick();
for (let frame = 0; frame < 12; frame++) { advance(1000 / 60); }
assert.deepEqual(stageClock.events.map(hit => hit.lane).toSorted(), [2, 5], 'unfiltered octave guess reaches two lanes');
audio.guitarOctaveRatio.value = 0.65;
await nextTick();
assert.equal(stageClock.events.length, 0, 'filter changes clear pending gems');
for (let frame = 0; frame < 12; frame++) { advance(1000 / 60); }
assert.deepEqual(stageClock.events.map(hit => hit.lane), [2], 'balanced filtering sends one E gem');
assert.equal(audio.guitarNotes.value, 'E3');
audio.guitarOctaveRatio.value = 999;
await nextTick();
assert.equal(audio.guitarOctaveRatio.value, 0.65, 'unknown filter settings return to balanced');
audio.guitarGateDb.value = -200;
audio.guitarTuningCents.value = 500;
await nextTick();
assert.equal(audio.guitarGateDb.value, -85, 'gate is bounded');
assert.equal(audio.guitarTuningCents.value, 50, 'tuning is bounded');
audio.setGuitarMode('spectrum');
assert.equal(guitarAnalyser.smoothingTimeConstant, 0.3);
assert.equal(timers.size, 0, 'spectrum mode stops note analysis');
assert.ok(stageClock.lanes.every(level => level === 0));
assert.equal(stageClock.events.length, 0, 'mode changes clear queued attacks');

// Two mounted consumers share one stream; releasing one must leave it running.
audio.acquire();
audio.release();
assert.equal(latest.track.stopped, false);
let ticks = 0;
const unsubscribe = audio.onTick(() => { ticks++; });
advance(1000 / 60);
unsubscribe();
advance(1000 / 60);
assert.equal(ticks, 1, 'tick observers have an explicit unsubscribe');

// Teardown invalidates outstanding requests as well as stopping active tracks.
const leaving = audio.startGuitar('leaving');
assert.equal(latest.track.stopped, true);
audio.release();
audio.dispose();
const late = stream('leaving');
requests.shift().resolve(late);
await leaving;
assert.equal(late.track.stopped, true);
assert.equal(audio.guitarStatus.value, 'Guitar input is off');
assert.deepEqual(connected, [current, latest]);
assert.equal(timers.size, 0, 'teardown stops the analysis timer');
console.log('Guitar quiet notes, chords, re-strums, source changes, device races and teardown checks passed');
