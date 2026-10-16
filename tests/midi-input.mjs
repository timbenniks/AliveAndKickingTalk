import assert from 'node:assert/strict';
import { createMidiInput } from '../app/utils/midi-input.ts';

class Port extends EventTarget {
  constructor(id, name = 'Alive Guitar MIDI') { super(); this.id = id; this.name = name; this.state = 'connected'; }
  async open() { this.opened = true; return this; }
  async close() { this.opened = false; return this; }
  send(data) { const event = new Event('midimessage'); event.data = new Uint8Array(data); this.dispatchEvent(event); }
}
const access = new EventTarget();
const port = new Port('native');
const amp = new Port('amp', 'Amp');
access.inputs = new Map([[port.id, port], [amp.id, amp]]);
const saved = new Map();
globalThis.localStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
let options;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { requestMIDIAccess: async opt => { options = opt; return access; } } });
const updates = [];
const midi = createMidiInput((notes, attack, reset) => updates.push({ notes, attack, reset }));
await midi.connect();
assert.deepEqual(options, { sysex: false });
assert.equal(midi.inputId.value, 'native');
assert.equal(midi.connected.value, true);
for (const note of [40,47,52,56,59,64]) port.send([0x90, note, 96]);
assert.deepEqual(updates.at(-1).notes.map(n => n.note), [40,47,52,56,59,64]);
port.send([0x90, 40, 110]);
assert.equal(updates.at(-1).notes.length, 6, 'repeat attack replaces held note');
assert.equal(updates.at(-1).attack, 40);
port.send([0x91, 40, 80]);
port.send([0x90, 40, 0]);
assert.equal(updates.at(-1).notes.length, 6, 'velocity-zero releases only the matching channel');
port.send([0x81, 40, 0]);
assert.equal(updates.at(-1).notes.length, 5);
const count = updates.length;
port.send([0xc0, 12]); port.send([0x90, 12, 96]); port.send([0xf8]);
assert.equal(updates.length, count, 'program changes, out-of-range notes and clock are ignored');
port.send([0xb0, 123, 0]);
assert.equal(updates.at(-1).notes.length, 0);
assert.equal(updates.at(-1).reset, true);
port.send([0x90, 45, 96]);
port.state = 'disconnected'; access.dispatchEvent(new Event('statechange'));
assert.equal(midi.connected.value, false);
assert.equal(updates.at(-1).notes.length, 0);
port.state = 'connected'; access.dispatchEvent(new Event('statechange'));
assert.equal(midi.connected.value, true);
midi.selectInput('amp');
assert.equal(saved.get('alive-guitar-midi-input'), 'Amp');
const switched = updates.length;
port.send([0x90, 45, 96]);
assert.equal(updates.length, switched, 'old input listener removed');
midi.stop();
const stopped = updates.length;
amp.send([0x90, 52, 96]); access.dispatchEvent(new Event('statechange'));
assert.equal(updates.length, stopped, 'stop removes all input listeners');
let resolve;
navigator.requestMIDIAccess = () => new Promise(done => { resolve = done; });
const pending = midi.connect();
midi.stop(); resolve(access); await pending;
assert.equal(midi.connected.value, false, 'late permission cannot reactivate a stopped source');
navigator.requestMIDIAccess = async () => { throw Error('denied'); };
await midi.connect(); assert.match(midi.status.value, /blocked/);
midi.stop();
console.log('MIDI chords, channels, retriggers, note-off, panic, reconnect, teardown and permission-race checks passed');
