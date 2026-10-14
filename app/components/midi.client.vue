<script setup lang="ts">
import type { Song } from '~/types';
import { presetAtTime } from '#shared/utils/performance';

// Without a song (/config) it only picks the ports.
const props = defineProps<{ song?: Song; time?: number }>();
const { midiNote } = useStageAudio();
const { ready, outputs, inputs, outputId, inputId, status, connect, selectInput, selectOutput, sendProgramChange } = useMidi(midiNote);
let selectedPreset: number | null = null;
const preset = computed(() => props.song ? presetAtTime(props.song.presets, props.time ?? 0) : undefined);

function sendPreset() {
  if (!preset.value || selectedPreset === preset.value.pc) return;
  selectedPreset = sendProgramChange(preset.value.pc) ? preset.value.pc : null;
}

// A new or reconnected output has not heard the current preset yet.
watch([outputId, outputs], () => { selectedPreset = null; sendPreset(); });
watch(preset, sendPreset);
</script>

<template>
  <div class="rig-midi">
    <template v-if="song">
      <p class="rig-field"><span>Amp preset</span></p>
      <p class="rig-preset">{{ preset?.name || 'No preset scheduled' }}</p>
    </template>
    <label class="rig-field">
      <span>Amp MIDI output</span>
      <select :value="outputId" @change="selectOutput(($event.target as HTMLSelectElement).value)">
        <option value="">Select output</option>
        <option v-for="output in outputs" :key="output.id" :value="output.id">{{ output.name }}</option>
      </select>
    </label>
    <label class="rig-field">
      <span>Guitar MIDI input</span>
      <select :value="inputId" @change="selectInput(($event.target as HTMLSelectElement).value)">
        <option value="">None</option>
        <option v-for="input in inputs" :key="input.id" :value="input.id">{{ input.name }}</option>
      </select>
    </label>
    <p role="status" class="rig-status">{{ status }}</p>
    <PixelButton v-if="!ready || !outputId" variant="secondary" @click="connect">Reconnect MIDI</PixelButton>
  </div>
</template>

<style>
.rig-midi { display: grid; gap: 0.75rem; justify-items: start; }
.rig-midi .rig-field { width: 100%; }
.rig-preset { font-family: var(--font-pixel); font-size: 1.75rem; line-height: 1; margin-top: -0.5rem; }
</style>
