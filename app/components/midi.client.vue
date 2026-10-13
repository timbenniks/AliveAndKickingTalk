<script setup lang="ts">
import type { Song } from '~/types';
import { presetAtTime } from '#shared/utils/performance';

const props = defineProps<{ song: Song; time: number }>();
const { midiNote } = useStageAudio();
const { ready, outputs, inputs, outputId, inputId, status, connect, selectInput, selectOutput, sendProgramChange } = useMidi(midiNote);
let selectedPreset: number | null = null;
const preset = computed(() => presetAtTime(props.song.presets, props.time));

function sendPreset() {
  if (!preset.value || selectedPreset === preset.value.pc) return;
  selectedPreset = sendProgramChange(preset.value.pc) ? preset.value.pc : null;
}

// A new or reconnected output has not heard the current preset yet.
watch([outputId, outputs], () => { selectedPreset = null; sendPreset(); });
watch(preset, sendPreset);
</script>

<template>
  <div class="relative left-12 inline-block mb-4">
    <p class="text-grey uppercase font-light text-2xl">Amp preset:</p>
    <p class="font-black uppercase text-3xl">{{ preset?.name || 'No preset scheduled' }}</p>
    <label class="block text-sm mt-2">
      MIDI output
      <select :value="outputId" class="bg-black text-white border p-1 ml-2" @change="selectOutput(($event.target as HTMLSelectElement).value)">
        <option value="">Select output</option>
        <option v-for="output in outputs" :key="output.id" :value="output.id">{{ output.name }}</option>
      </select>
    </label>
    <label class="block text-sm mt-2">
      Guitar MIDI input
      <select :value="inputId" class="bg-black text-white border p-1 ml-2" @change="selectInput(($event.target as HTMLSelectElement).value)">
        <option value="">None</option>
        <option v-for="input in inputs" :key="input.id" :value="input.id">{{ input.name }}</option>
      </select>
    </label>
    <p role="status" class="text-sm mt-1">{{ status }}</p>
    <button v-if="!ready || !outputId" class="underline text-sm" @click="connect">Reconnect MIDI</button>
  </div>
</template>
