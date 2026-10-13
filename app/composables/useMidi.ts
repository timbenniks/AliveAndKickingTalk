import { WebMidi } from 'webmidi';
import type { Input, Output } from 'webmidi';

// One WebMIDI connection per page. Output: amp program changes on channel 1.
// Input: a MIDI guitar pickup, one string per channel (1-6 = lanes 0-5).

const OUTPUT_KEY = 'alive-midi-output';
const INPUT_KEY = 'alive-midi-input';
const STRING_CHANNELS = [1, 2, 3, 4, 5, 6];

const ready = ref(false);
const outputs = shallowRef<Output[]>([]);
const inputs = shallowRef<Input[]>([]);
const outputId = ref('');
const inputId = ref('');
const status = ref('MIDI is not connected');
let listening: Input | null = null;
let enabling: Promise<void> | null = null;
type NoteHandler = (lane: number, velocity: number, on: boolean) => void;
const noteHandlers = new Set<NoteHandler>();

function stored(key: string, fallback = '') {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

function store(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Private mode: settings are per session. */ }
}

function emitNote(lane: number, velocity: number, on: boolean) {
  for (const handler of noteHandlers) handler(lane, velocity, on);
}

function listenTo(id: string) {
  listening?.removeListener();
  listening = inputs.value.find(port => port.id === id) || null;
  if (!listening) return;
  listening.addListener('noteon', e => emitNote(e.message.channel - 1, e.note.attack, true), { channels: STRING_CHANNELS });
  listening.addListener('noteoff', e => emitNote(e.message.channel - 1, 0, false), { channels: STRING_CHANNELS });
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
  status.value = outputId.value ? 'MIDI connected' : 'Select a MIDI output. Check Audio MIDI Setup if it is missing.';
}

async function connect() {
  if (enabling) return enabling;
  enabling = (async () => {
    try {
      await WebMidi.enable();
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
}

function selectOutput(id: string) {
  outputId.value = id;
  const output = outputs.value.find(port => port.id === id);
  if (output) store(OUTPUT_KEY, output.name);
  status.value = output ? 'MIDI connected' : 'No MIDI output selected';
}

// Returns false when nothing was sent, so the caller can retry later.
function sendProgramChange(pc: number) {
  const output = outputs.value.find(port => port.id === outputId.value);
  if (!output) return false;
  try {
    output.sendProgramChange(pc, { channels: [1] });
    status.value = 'MIDI connected';
    return true;
  } catch {
    status.value = 'MIDI send failed. Check the device connection.';
    return false;
  }
}

export function useMidi(onNote?: NoteHandler) {
  onMounted(() => {
    if (onNote) noteHandlers.add(onNote);
    void connect();
  });
  onUnmounted(() => {
    if (onNote) noteHandlers.delete(onNote);
  });
  return { ready, outputs, inputs, outputId, inputId, status, connect, selectInput, selectOutput, sendProgramChange };
}
