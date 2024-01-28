<script setup lang="ts">
import { WebMidi, Output } from "webmidi";
import type { AmpPreset } from "../types";

const props = defineProps(["song", "time"]);
const selectedPreset = ref(0);

const presets = computed(() => {
  return props.song.presets;
});

const selectedPresetName = ref(presets.value[0].name);

function findPresetForTime(time: number) {
  let presetIndex = 0;
  presets.value.forEach((preset: AmpPreset, index: number) => {
    if (time >= preset.at) {
      presetIndex = index;
    }
  });

  selectedPresetName.value = presets.value[presetIndex].name;
  return presetIndex;
}

watch(
  () => props.time,
  (updatedTime) => {
    const presetIndex = findPresetForTime(updatedTime);
    setPreset(presets.value[presetIndex].pc);
  }
);

await WebMidi.enable().catch((err) => console.error(err));
const output: Output = WebMidi.getOutputByName("IAC Driver Alive and Kicking");

function setPreset(pc: number) {
  if (selectedPreset.value === pc) {
    return false;
  }

  selectedPreset.value = pc;
  output.channels[1].sendProgramChange(pc);
}

// set first preset as default guitar sound
onMounted(() => {
  setPreset(presets.value[0].pc);
});
</script>

<template>
  <div class="relative left-12 inline-block bg-opacity-50 mb-4">
    <p class="text-grey uppercase font-light text-2xl">Amp preset:</p>
    <p class="font-black uppercase text-3xl">
      {{ selectedPresetName }}
    </p>
  </div>
</template>
