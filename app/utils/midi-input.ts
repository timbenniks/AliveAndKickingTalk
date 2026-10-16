import { ref, shallowRef } from 'vue';
import { readPreference, writePreference } from './preferences.ts';

// Own MIDIAccess connection: never disable the amp's WebMidi singleton.
export function createMidiInput(changed: (notes: Array<{ note: number; strength: number }>, attack?: number, reset?: boolean) => void) {
  const inputs = shallowRef<Array<{ id: string; name: string }>>([]);
  const inputId = ref('');
  const status = ref('MIDI input is off');
  const connected = ref(false);
  const held = new Map<number, { note: number; strength: number }>();
  let access: MIDIAccess | null = null;
  let port: MIDIInput | null = null;
  let generation = 0;
  let listening = false;
  const key = 'alive-guitar-midi-input';

  function clear() { held.clear(); changed([], undefined, true); }
  function message(event: MIDIMessageEvent) {
    const data = event.data;
    if (!listening || !data || data.length < 3) return;
    const [statusByte = 0, note = 0, velocity = 0] = data;
    const kind = statusByte & 0xf0;
    const channel = statusByte & 15;
    if (note > 127 || velocity > 127) return;
    if (kind === 0xb0 && (note === 120 || note === 123)) {
      for (const id of held.keys()) if ((id >> 7) === channel) held.delete(id);
      changed([...held.values()], undefined, true);
      return;
    }
    if (note < 38 || note > 88 || (kind !== 0x90 && kind !== 0x80)) return;
    const id = channel * 128 + note;
    const on = kind === 0x90 && velocity > 0;
    if (on) held.set(id, { note, strength: velocity / 127 });
    else held.delete(id);
    changed([...held.values()], on ? note : undefined);
  }
  function detach() {
    port?.removeEventListener('midimessage', message);
    if (port) void port.close().catch(() => {});
    port = null;
    connected.value = false;
    clear();
  }
  function attach() {
    const next = access?.inputs.get(inputId.value) ?? null;
    if (next === port) return;
    detach();
    port = next;
    if (!port) { status.value = 'Select a MIDI input'; return; }
    const selected = port;
    selected.addEventListener('midimessage', message);
    connected.value = true;
    status.value = `Listening to ${selected.name || 'MIDI input'}`;
    void selected.open().then(() => {
      if (port !== selected || !listening) void selected.close().catch(() => {});
    }).catch(() => {
      if (port !== selected) return;
      detach();
      status.value = 'MIDI input could not be opened. Reconnect to retry.';
    });
  }
  function refresh() {
    if (!access || !listening) return;
    inputs.value = [...access.inputs.values()].filter(p => p.state === 'connected').map(p => ({ id: p.id, name: p.name || 'MIDI input' }));
    if (!inputs.value.some(p => p.id === inputId.value)) {
      const saved = readPreference(key) || 'Alive Guitar MIDI';
      inputId.value = inputs.value.find(p => p.name === saved)?.id || '';
    }
    attach();
  }
  async function connect() {
    const request = ++generation;
    listening = true;
    if (access) { refresh(); return; }
    if (!navigator.requestMIDIAccess) { status.value = 'Use a browser with MIDI support, such as Chrome or Edge'; return; }
    status.value = 'Connecting MIDI input…';
    try {
      const result = await navigator.requestMIDIAccess({ sysex: false });
      if (request !== generation || !listening) return;
      access = result;
      access.addEventListener('statechange', refresh);
      refresh();
    } catch {
      if (request === generation) status.value = 'MIDI access was blocked. Allow MIDI access and reconnect.';
    }
  }
  function selectInput(id: string) {
    inputId.value = id;
    writePreference(key, inputs.value.find(p => p.id === id)?.name || '');
    attach();
  }
  function stop() {
    generation++;
    listening = false;
    access?.removeEventListener('statechange', refresh);
    detach();
    access = null;
    inputs.value = [];
    status.value = 'MIDI input is off';
  }
  return { inputs, inputId, status, connected, connect, selectInput, stop, clear };
}
