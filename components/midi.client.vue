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

function setPreset(preset: number) {
  output.channels[1].sendProgramChange(preset);
}

// set first preset as default guitar sound
setPreset(presets.value[0].pc);
</script>

<template>
  <div class="pl-12">
    <p class="text-grey uppercase font-light text-xl">Amp preset:</p>
    <p class="font-black uppercase text-2xl">{{ song.preset.name }}</p>
    <p>{{ time }}</p>
  </div>
</template>
