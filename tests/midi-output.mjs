import assert from 'node:assert/strict';

// MIDI is output-only: preserve amp preset selection, program zero, saved
// device names and reconnect/error handling without touching note inputs.
const { WebMidi } = await import('webmidi');
const midiListeners = new Map();
const programs = [];
const ampPort = { id: 'amp', name: 'IAC Driver Alive and Kicking',
  sendProgramChange: (pc, options) => programs.push({ pc, options }),
};
let availableOutputs = [ampPort];
Object.defineProperties(WebMidi, {
  inputs: { configurable: true, get: () => { throw Error('Guitar MIDI input must not be used'); } },
  outputs: { configurable: true, get: () => availableOutputs },
});
WebMidi.enable = async () => WebMidi;
WebMidi.addListener = (event, callback) => midiListeners.set(event, callback);
WebMidi.removeListener = event => midiListeners.delete(event);
const midiSettings = new Map();
globalThis.localStorage = {
  getItem: key => midiSettings.get(key) ?? null,
  setItem: (key, value) => midiSettings.set(key, value),
};
const { createMidiOutput } = await import('../app/utils/midi-output.ts');
const midi = createMidiOutput();
midi.acquire();
midi.acquire();
await midi.connect();
assert.equal(midi.outputId.value, 'amp');
assert.equal(midi.status.value, 'Amp MIDI output connected');
assert.equal(midi.sendProgramChange(0), true, 'program zero remains supported');
assert.deepEqual(programs, [{ pc: 0, options: { channels: [1] } }]);
midi.selectOutput('');
assert.equal(midi.sendProgramChange(5), false, 'missing output can be retried');
const otherAmp = { ...ampPort, id: 'other', name: 'Other amp output' };
availableOutputs.push(otherAmp);
midiListeners.get('connected')();
midi.selectOutput('other');
assert.equal(midiSettings.get('alive-midi-output'), 'Other amp output');
availableOutputs = [];
midiListeners.get('disconnected')();
assert.equal(midi.outputId.value, '');
assert.equal(midi.sendProgramChange(5), false);
availableOutputs = [{ ...otherAmp, id: 'reconnected' }];
midiListeners.get('connected')();
assert.equal(midi.outputId.value, 'reconnected', 'reconnect restores the output by saved name');
assert.equal(midi.sendProgramChange(42), true);
availableOutputs[0].sendProgramChange = () => { throw Error('device unavailable'); };
assert.equal(midi.sendProgramChange(12), false, 'send failure remains retryable');
assert.match(midi.status.value, /MIDI send failed/);
console.log('Amp MIDI output selection, program zero, saved device, disconnect/reconnect and failure checks passed');

midi.release();
assert.equal(midiListeners.size, 2, 'another consumer still owns the output connection');
midi.release();
assert.equal(midiListeners.size, 0, 'last consumer releases MIDI listeners');
midi.dispose();

let finishPermission;
WebMidi.enable = () => new Promise(resolve => { finishPermission = resolve; });
const pending = createMidiOutput();
pending.acquire();
await new Promise(resolve => setImmediate(resolve));
const connecting = pending.connect();
pending.release();
finishPermission(WebMidi);
await connecting;
assert.equal(midiListeners.size, 0, 'late permission does not restore abandoned listeners');
pending.dispose();
