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
Object.assign(globalThis, {
  requestAnimationFrame: callback => { renderFrame = callback; return 1; },
  cancelAnimationFrame: () => {},
  performance: { now: () => wall },
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
  wall += 1000;
  renderFrame();
  stageClock.bass = stageClock.mid = stageClock.treble = stageClock.energy = 1;
  stageClock.lanes.fill(1);
  for (let frame = 0; frame < hz; frame++) { wall += 1000 / hz; renderFrame(); }
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
for (let frame = 0; frame < 30; frame++) { wall += 1000 / 60; renderFrame(); }
assert.equal(stageClock.events.length, 0);
inputDb = -62;
wall += 1000 / 60;
renderFrame();
assert.equal(stageClock.events.length, 1);
assert.equal(stageClock.events[0].lane, 0);
stageClock.events.length = 0;
for (let frame = 0; frame < 30; frame++) { wall += 1000 / 60; renderFrame(); }
// The existing detector can emit another pulse during the attack, then settles.
assert.ok(stageClock.events.length <= 1);
stageClock.events.length = 0;
for (let frame = 0; frame < 30; frame++) { wall += 1000 / 60; renderFrame(); }
assert.equal(stageClock.events.length, 0);
inputDb = -72;
for (let frame = 0; frame < 30; frame++) { wall += 1000 / 60; renderFrame(); }
inputDb = -62;
wall += 1000 / 60;
renderFrame();
assert.equal(stageClock.events.length, 1);

// A strummed E-major spectrum (fundamentals plus harmonics) must light several
// lanes immediately, without requiring one stable fundamental. Test the actual
// tick at ordinary and high display refresh rates, including release/re-strum.
inputPeaks = [82.41, 123.47, 164.81, 207.65, 246.94, 329.63, 494, 659, 989]
  .map(hz => Math.round(hz / (48000 / 4096)));
for (const refreshRate of [30, 60, 120, 144]) {
  for (let strum = 0; strum < 2; strum++) {
    inputDb = -72;
    for (let frame = 0; frame < refreshRate / 2; frame++) { wall += 1000 / refreshRate; renderFrame(); }
    stageClock.events.length = 0;
    inputDb = -50;
    wall += 1000 / refreshRate;
    renderFrame();
    assert.equal(stageClock.events.length, 3, 'a chord produces the three strongest lane pulses');
    assert.equal(new Set(stageClock.events.map(event => event.lane)).size, 3);
    assert.ok(stageClock.lanes.every(level => level > 0.2), 'all six spectrum zones respond');
    for (let frame = 0; frame < refreshRate; frame++) { wall += 1000 / refreshRate; renderFrame(); }
    stageClock.events.length = 0;
    for (let frame = 0; frame < refreshRate / 2; frame++) { wall += 1000 / refreshRate; renderFrame(); }
    assert.equal(stageClock.events.length, 0, 'a held chord settles without flooding gems');
  }
}

// The experimental polyphonic path drives all six lanes without sending guitar
// audio to speakers, and performs at most 30 fits/second at any display rate.
for (const refreshRate of [30, 60, 120, 144]) {
  audio.setGuitarMode('polyphonic');
  assert.equal(guitarAnalyser.smoothingTimeConstant, 0);
  stageClock.events.length = 0;
  polyInput = spectrum([40, 47, 52, 56, 59, 64]);
  const before = polyReads;
  for (let frame = 0; frame < refreshRate; frame++) { wall += 1000 / refreshRate; renderFrame(); }
  assert.ok(polyReads - before <= 31, 'fit rate is capped independently of display refresh');
  assert.equal(stageClock.events.length, 6, 'six chord voices produce six attacks');
  assert.deepEqual(stageClock.events.map(hit => hit.lane).toSorted(), [0, 1, 2, 3, 4, 5]);
  assert.ok(stageClock.lanes.every(level => level > 0));
  assert.match(audio.guitarNotes.value, /E2/);
  assert.ok(audio.guitarInputDb.value > audio.guitarGateDb.value, 'debug exposes signal level above the gate');
  polyInput.fill(-Infinity);
  for (let frame = 0; frame < refreshRate / 3; frame++) { wall += 1000 / refreshRate; renderFrame(); }
  assert.ok(stageClock.lanes.every(level => level === 0), 'released chord clears all lanes');
  assert.equal(audio.guitarInputDb.value, -120, 'silence is visible below the gate');
}
// Octave filtering is wired through the real input tick, not only the helper.
polyInput = spectrum([52], { harmonicGains: [1, 2, 1, 1.6, 1, 1.2, 1, 1, 1, 1] });
audio.guitarOctaveRatio.value = 0;
await nextTick();
for (let frame = 0; frame < 12; frame++) { wall += 1000 / 60; renderFrame(); }
assert.deepEqual(stageClock.events.map(hit => hit.lane).toSorted(), [2, 5], 'unfiltered octave guess reaches two lanes');
audio.guitarOctaveRatio.value = 0.65;
await nextTick();
assert.equal(stageClock.events.length, 0, 'filter changes clear pending gems');
for (let frame = 0; frame < 12; frame++) { wall += 1000 / 60; renderFrame(); }
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
assert.ok(stageClock.lanes.every(level => level === 0));
assert.equal(stageClock.events.length, 0, 'mode changes clear queued attacks');

// Two mounted consumers share one stream; releasing one must leave it running.
audio.acquire();
audio.release();
assert.equal(latest.track.stopped, false);
let ticks = 0;
const unsubscribe = audio.onTick(() => { ticks++; });
wall += 1000 / 60;
renderFrame();
unsubscribe();
wall += 1000 / 60;
renderFrame();
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
console.log('Guitar quiet notes, chords, re-strums, source changes, device races and teardown checks passed');
