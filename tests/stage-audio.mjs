import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { ref, shallowRef, watch } from 'vue';

// Import the actual Nuxt composable with its shared alias and lifecycle hooks.
// All audio devices are fakes: this test never opens a microphone or plays sound.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('#shared/')) {
      return nextResolve(new URL(`../shared/${specifier.slice(8)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const mounted = [];
const unmounted = [];
let renderFrame;
let wall = 1000;
Object.assign(globalThis, {
  ref, shallowRef, watch,
  onMounted: callback => mounted.push(callback),
  onUnmounted: callback => unmounted.push(callback),
  requestAnimationFrame: callback => { renderFrame = callback; return 1; },
  cancelAnimationFrame: () => {},
  performance: { now: () => wall },
  localStorage: { getItem: () => null, setItem: () => {} },
});

const requests = [];
const connected = [];
let guitarAnalyser;
let inputDb = -72;
let inputPeaks = [7];
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

const { useStageAudio } = await import('../app/composables/useStageAudio.ts');
const audio = useStageAudio();
mounted.forEach(callback => callback());

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

// Exercise the real WebMIDI routing into the actual stage clock. MG3 Legacy
// sends an entire chord on channel 1; its pitches must reach distinct lanes.
const { WebMidi } = await import('webmidi');
const portListeners = new Map();
const midiListeners = new Map();
const midiPort = {
  id: 'mg3', name: 'MIDI Guitar Virtual Output',
  addListener: (event, callback) => portListeners.set(event, callback),
  removeListener: () => portListeners.clear(),
};
let availableInputs = [midiPort];
Object.defineProperties(WebMidi, {
  inputs: { configurable: true, get: () => availableInputs },
  outputs: { configurable: true, get: () => [] },
});
WebMidi.enable = async () => WebMidi;
WebMidi.addListener = (event, callback) => midiListeners.set(event, callback);
WebMidi.removeListener = event => midiListeners.delete(event);
const midiSettings = new Map();
globalThis.localStorage = {
  getItem: key => midiSettings.get(key) ?? null,
  setItem: (key, value) => midiSettings.set(key, value),
};
const { useMidi } = await import('../app/composables/useMidi.ts');
const midi = useMidi(audio.midiNote);
mounted.at(-1)();
await midi.connect();
midi.selectInput('mg3');
assert.equal(midi.inputMode.value, 'notes');
assert.equal(midi.status.value, 'Listening to MIDI Guitar Virtual Output');
audio.setLaneSource('midi');
function midiEvent(pitch, channel = 1, velocity = 0.8) {
  return { message: { channel }, note: { number: pitch, attack: velocity } };
}
for (const pitch of [40, 47, 52, 56, 59, 64]) portListeners.get('noteon')(midiEvent(pitch));
assert.deepEqual(stageClock.events.map(event => event.lane), [0, 1, 2, 3, 4, 5]);
assert.ok(stageClock.lanes.every(level => level === 0.8));
stageClock.events.length = 0;
// Two notes in the same lane keep sounding until both are released; releases
// must not generate gems, and different MPE channels can hold the same pitch.
portListeners.get('noteon')(midiEvent(67, 1, 0.6));
portListeners.get('noteoff')(midiEvent(64));
assert.equal(stageClock.lanes[5], 0.6);
assert.equal(stageClock.events.length, 1);
portListeners.get('noteon')(midiEvent(67, 16, 0.7));
portListeners.get('noteoff')(midiEvent(67, 1));
assert.equal(stageClock.lanes[5], 0.7);
portListeners.get('noteoff')(midiEvent(67, 16));
assert.equal(stageClock.lanes[5], 0);
// Repeated note-ons retrigger rather than incrementing a stuck-note count.
stageClock.events.length = 0;
portListeners.get('noteon')(midiEvent(64));
portListeners.get('noteon')(midiEvent(64));
assert.equal(stageClock.events.length, 2);
portListeners.get('noteon')(midiEvent(64, 1, 0));
assert.equal(stageClock.lanes[5], 0);
portListeners.get('noteon')(midiEvent(64, 16));
portListeners.get('controlchange')({ message: { channel: 1 }, controller: { number: 123 } });
assert.ok(stageClock.lanes.slice(0, 5).every(level => level === 0));
assert.equal(stageClock.lanes[5], 0.8);
portListeners.get('controlchange')({ message: { channel: 16 }, controller: { number: 120 } });
assert.ok(stageClock.lanes.every(level => level === 0));
// A port refresh while the same input remains connected must not drop notes.
portListeners.get('noteon')(midiEvent(40));
midiListeners.get('connected')();
assert.equal(stageClock.lanes[0], 0.8);
// Legacy pickup routing is explicitly selectable and persisted.
midi.selectInputMode('strings');
assert.equal(midiSettings.get('alive-midi-input-mode'), 'strings');
assert.ok(stageClock.lanes.every(level => level === 0));
stageClock.events.length = 0;
portListeners.get('noteon')(midiEvent(64, 6));
portListeners.get('noteon')(midiEvent(64, 7));
assert.deepEqual(stageClock.events.map(event => event.lane), [5]);
midi.selectInputMode('notes');
assert.ok(stageClock.lanes.every(level => level === 0));
portListeners.get('noteon')(midiEvent(40));
midi.selectInput('');
assert.ok(stageClock.lanes.every(level => level === 0));
assert.equal(portListeners.size, 0);
midi.selectInput('mg3');
portListeners.get('noteon')(midiEvent(40));
availableInputs = [];
midiListeners.get('disconnected')();
assert.ok(stageClock.lanes.every(level => level === 0));
assert.equal(portListeners.size, 0);
console.log('MG3 chords, overlapping MIDI notes, channels, panic, routing modes and disconnect checks passed');

// Teardown invalidates outstanding requests as well as stopping active tracks.
const leaving = audio.startGuitar('leaving');
assert.equal(latest.track.stopped, true);
unmounted.forEach(callback => callback());
const late = stream('leaving');
requests.shift().resolve(late);
await leaving;
assert.equal(late.track.stopped, true);
assert.equal(audio.guitarStatus.value, 'Guitar input is off');
assert.deepEqual(connected, [current, latest]);
console.log('Guitar quiet notes, chords, re-strums, source changes, device races and teardown checks passed');
