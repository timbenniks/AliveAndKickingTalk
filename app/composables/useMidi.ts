import { WebMidi } from 'webmidi';
import type { Input, Output } from 'webmidi';

// One WebMIDI connection per page. Output: amp program changes on channel 1.
// Input: software-converted note pitches, or a pickup with one string per channel.

const OUTPUT_KEY = 'alive-midi-output';
const INPUT_KEY = 'alive-midi-input';
const MODE_KEY = 'alive-midi-input-mode';
type MidiInputMode = 'notes' | 'strings';
// Low-to-high pitch lanes aligned with standard open-string notes. These are
// visual pitch ranges, not an estimate of which physical string was played.
const LANE_STARTS = [40, 45, 50, 55, 59, 64];

const ready = ref(false);
const outputs = shallowRef<Output[]>([]);
const inputs = shallowRef<Input[]>([]);
const outputId = ref('');
const inputId = ref('');
const inputMode = ref<MidiInputMode>('notes');
const status = ref('MIDI is not connected');
let listening: Input | null = null;
let enabling: Promise<void> | null = null;
type NoteHandler = (lane: number, velocity: number, on: boolean) => void;
const noteHandlers = new Set<NoteHandler>();
const heldNotes = new Map<number, { lane: number; velocity: number }>();
let users = 0;

function stored(key: string, fallback = '') {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

function store(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Private mode: settings are per session. */ }
}

function emitNote(lane: number, velocity: number, on: boolean) {
  for (const handler of noteHandlers) handler(lane, velocity, on);
}

function clearNotes(channel?: number) {
  for (const key of heldNotes.keys()) {
    if (channel === undefined || Math.floor(key / 128) === channel) heldNotes.delete(key);
  }
  for (let lane = 0; lane < 6; lane++) emitNote(lane, laneLevel(lane), false);
}

function laneLevel(lane: number) {
  let level = 0;
  for (const note of heldNotes.values()) if (note.lane === lane) level = Math.max(level, note.velocity);
  return level;
}

function receiveNote(channel: number, pitch: number, velocity: number, on: boolean) {
  const key = channel * 128 + pitch;
  if (!on || velocity === 0) {
    const held = heldNotes.get(key);
    if (!held) return;
    heldNotes.delete(key);
    emitNote(held.lane, laneLevel(held.lane), false);
    return;
  }
  const lane = inputMode.value === 'strings' ? channel - 1 : Math.max(0, LANE_STARTS.findLastIndex(start => pitch >= start));
  if (lane < 0 || lane > 5) return;
  heldNotes.set(key, { lane, velocity });
  emitNote(lane, laneLevel(lane), true);
}

function listenTo(id: string) {
  const next = inputs.value.find(port => port.id === id) || null;
  if (next === listening) return;
  listening?.removeListener();
  clearNotes();
  listening = next;
  if (!listening) return;
  listening.addListener('noteon', e => receiveNote(e.message.channel, e.note.number, e.note.attack, true));
  listening.addListener('noteoff', e => receiveNote(e.message.channel, e.note.number, 0, false));
  listening.addListener('controlchange', e => {
    if (e.controller.number === 120 || e.controller.number === 123) clearNotes(e.message.channel);
  });
}

function updateStatus() {
  const input = inputs.value.find(port => port.id === inputId.value);
  const output = outputs.value.find(port => port.id === outputId.value);
  status.value = input ? `Listening to ${input.name}` : output ? 'Amp MIDI output connected' : 'Select a MIDI input or output. Check Audio MIDI Setup if it is missing.';
}

function refreshPorts() {
  outputs.value = [...WebMidi.outputs];
  inputs.value = [...WebMidi.inputs];
  if (!outputs.value.some(port => port.id === outputId.value)) {
    const savedName = stored(OUTPUT_KEY, 'IAC Driver Alive and Kicking');
    outputId.value = outputs.value.find(port => port.name === savedName)?.id || '';
  }
  if (!inputs.value.some(port => port.id === inputId.value)) {
    const savedName = stored(INPUT_KEY);
    inputId.value = inputs.value.find(port => port.name === savedName)?.id || '';
  }
  listenTo(inputId.value);
  updateStatus();
}

async function connect() {
  if (enabling) return enabling;
  enabling = (async () => {
    try {
      await WebMidi.enable();
      if (!users) return;
      inputMode.value = stored(MODE_KEY) === 'strings' ? 'strings' : 'notes';
      ready.value = true;
      WebMidi.removeListener('connected', refreshPorts);
      WebMidi.removeListener('disconnected', refreshPorts);
      WebMidi.addListener('connected', refreshPorts);
      WebMidi.addListener('disconnected', refreshPorts);
      refreshPorts();
    } catch {
      status.value = 'MIDI permission was denied or MIDI is unavailable. Allow access and retry.';
    } finally {
      enabling = null;
    }
  })();
  return enabling;
}

function selectInput(id: string) {
  inputId.value = id;
  const input = inputs.value.find(port => port.id === id);
  if (input) store(INPUT_KEY, input.name);
  listenTo(id);
  updateStatus();
}

function selectInputMode(mode: MidiInputMode) {
  if (mode !== 'notes' && mode !== 'strings') return;
  clearNotes();
  inputMode.value = mode;
  store(MODE_KEY, mode);
}

function selectOutput(id: string) {
  outputId.value = id;
  const output = outputs.value.find(port => port.id === id);
  if (output) store(OUTPUT_KEY, output.name);
  updateStatus();
}

// Returns false when nothing was sent, so the caller can retry later.
function sendProgramChange(pc: number) {
  const output = outputs.value.find(port => port.id === outputId.value);
  if (!output) return false;
  try {
    output.sendProgramChange(pc, { channels: [1] });
    updateStatus();
    return true;
  } catch {
    status.value = 'MIDI send failed. Check the device connection.';
    return false;
  }
}

export function useMidi(onNote?: NoteHandler) {
  onMounted(() => {
    users++;
    if (onNote) noteHandlers.add(onNote);
    void connect();
  });
  onUnmounted(() => {
    if (--users === 0) {
      listenTo('');
      WebMidi.removeListener('connected', refreshPorts);
      WebMidi.removeListener('disconnected', refreshPorts);
    }
    if (onNote) noteHandlers.delete(onNote);
  });
  return { ready, outputs, inputs, outputId, inputId, inputMode, status, connect, selectInput, selectInputMode, selectOutput, sendProgramChange };
}
