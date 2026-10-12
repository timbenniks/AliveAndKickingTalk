<script setup lang="ts">
import { WebMidi } from 'webmidi';
import type { Output } from 'webmidi';
import type { Song } from '~/types';
import { presetAtTime } from '#shared/utils/performance';

const props = defineProps<{ song: Song; time: number }>();
const outputs = shallowRef<Output[]>([]);
const outputId = ref('');
const status = ref('MIDI is not connected');
const ready = ref(false);
let selectedPreset: number | null = null;
let disposed = false;
const preset = computed(() => presetAtTime(props.song.presets, props.time));

function sendPreset() {
  const output = outputs.value.find(port => port.id === outputId.value);
  if (!output || !preset.value) return;
  if (selectedPreset === preset.value.pc) return;
  try {
    output.sendProgramChange(preset.value.pc, { channels: [1] });
    selectedPreset = preset.value.pc;
    status.value = 'MIDI connected';
  } catch {
    selectedPreset = null;
    status.value = 'MIDI send failed. Check the device connection.';
  }
}

function refreshOutputs() {
  const previousId = outputId.value;
  outputs.value = [...WebMidi.outputs];
  if (!outputs.value.some(port => port.id === outputId.value)) {
    const savedName = localStorage.getItem('alive-midi-output') || 'IAC Driver Alive and Kicking';
    outputId.value = outputs.value.find(port => port.name === savedName)?.id || '';
  }
  status.value = outputId.value ? 'MIDI connected' : 'Select a MIDI output. Check Audio MIDI Setup if it is missing.';
  if (previousId === outputId.value) { selectedPreset = null; sendPreset(); }
}

async function connect() {
  try {
    await WebMidi.enable();
    if (disposed) return;
    ready.value = true;
    WebMidi.removeListener('connected', refreshOutputs);
    WebMidi.removeListener('disconnected', refreshOutputs);
    WebMidi.addListener('connected', refreshOutputs);
    WebMidi.addListener('disconnected', refreshOutputs);
    refreshOutputs();
  } catch {
    status.value = 'MIDI permission was denied or MIDI is unavailable. Allow access and retry.';
  }
}

watch(outputId, () => {
  selectedPreset = null;
  const output = outputs.value.find(port => port.id === outputId.value);
  status.value = output ? 'MIDI connected' : 'No MIDI output selected';
  if (output) localStorage.setItem('alive-midi-output', output.name);
  sendPreset();
}, { flush: 'sync' });
watch(preset, sendPreset);
onMounted(connect);
onUnmounted(() => {
  disposed = true;
  WebMidi.removeListener('connected', refreshOutputs);
  WebMidi.removeListener('disconnected', refreshOutputs);
});
</script>

<template>
  <div class="relative left-12 inline-block mb-4">
    <p class="text-grey uppercase font-light text-2xl">Amp preset:</p>
    <p class="font-black uppercase text-3xl">{{ preset?.name || 'No preset scheduled' }}</p>
    <label class="block text-sm mt-2">
      MIDI output
      <select v-model="outputId" class="bg-black text-white border p-1 ml-2">
        <option value="">Select output</option>
        <option v-for="output in outputs" :key="output.id" :value="output.id">{{ output.name }}</option>
      </select>
    </label>
    <p role="status" class="text-sm mt-1">{{ status }}</p>
    <button v-if="!ready || !outputId" class="underline text-sm" @click="connect">Reconnect MIDI</button>
  </div>
</template>
