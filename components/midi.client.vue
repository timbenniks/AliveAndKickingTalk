<script setup lang="ts">
import { WebMidi, Output } from "webmidi";

type AmpPreset = {
  pc: number;
  name: string;
  at: number;
};

const props = defineProps(["song", "time"]);
const presets = computed(() => {
  return props.song.presets;
});

const selectedPreset = ref(0);
const selectedPresetName = computed(() => {
  return props.song.presets[selectedPreset.value].name;
});

function findPresetForTime(time: number) {
  let presetIndex = 0;
  presets.value.forEach((preset: AmpPreset, index: number) => {
    if (time >= preset.at) {
      presetIndex = index;
    }
  });

  return presetIndex;
}

watch(
  () => props.time,
  (updatedTime) => {
    const presetIndex = findPresetForTime(updatedTime);
    setPreset(presets.value[presetIndex].pc);
  }
);

await WebMidi.enable().catch((err) => console.log(err));
const output: Output = WebMidi.getOutputByName("IAC Driver Alive and Kicking");

function setPreset(pc: number) {
  if (selectedPreset.value === pc) {
    return false;
  }

  selectedPreset.value = pc;
  output.channels[1].sendProgramChange(pc);
}

// set first preset as default guitar sound
setPreset(presets.value[0].pc);
</script>

<template>
  <div class="pl-12">
    <p class="text-grey uppercase font-light text-xl">Amp preset:</p>
    <p class="font-black uppercase text-2xl">
      {{ selectedPresetName }}
    </p>
  </div>
</template>
