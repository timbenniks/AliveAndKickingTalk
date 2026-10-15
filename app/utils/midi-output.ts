import { ref, shallowRef } from 'vue';
import { readPreference, writePreference as store } from './preferences.ts';
import type { Output } from 'webmidi';

export function createMidiOutput() {
  // One WebMIDI connection per page for amp program changes on channel 1.

  const OUTPUT_KEY = 'alive-midi-output';

  const ready = ref(false);
  const outputs = shallowRef<Output[]>([]);
  const outputId = ref('');
  const status = ref('MIDI is not connected');
  let enabling: Promise<void> | null = null;
  let users = 0;
  let webMidi: typeof import('webmidi').WebMidi | null = null;

  function updateStatus() {
    const output = outputs.value.find(port => port.id === outputId.value);
    status.value = output ? 'Amp MIDI output connected' : 'Select an amp MIDI output. Check Audio MIDI Setup if it is missing.';
  }

  function refreshPorts() {
    outputs.value = [...(webMidi?.outputs || [])];
    if (!outputs.value.some(port => port.id === outputId.value)) {
      const savedName = readPreference(OUTPUT_KEY) || 'IAC Driver Alive and Kicking';
      outputId.value = outputs.value.find(port => port.name === savedName)?.id || '';
    }
    updateStatus();
  }

  async function connect() {
    if (enabling) return enabling;
    enabling = (async () => {
      try {
        const { WebMidi } = await import('webmidi');
        if (!users) return;
        webMidi = WebMidi;
        await WebMidi.enable();
        if (!users) return;
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

  function acquire() {
    users++;
    void connect();
  }

  function release() {
    if (users > 0 && --users === 0) {
      webMidi?.removeListener('connected', refreshPorts);
      webMidi?.removeListener('disconnected', refreshPorts);
    }
  }

  function dispose() {
    users = 1;
    release();
  }

  return { ready, outputs, outputId, status, connect, selectOutput, sendProgramChange, acquire, release, dispose };
}
