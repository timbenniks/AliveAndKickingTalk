<script setup lang="ts">
import { WebMidi } from "webmidi";

const props = defineProps(["song"]);
const DEVICE_OUTPUT = "IAC Driver Alive and Kicking";

WebMidi.enable()
  .then(() => {
    const output = WebMidi.getOutputByName(DEVICE_OUTPUT);
    output.channels[1].sendProgramChange(props.song.preset.channel);
  })
  .catch((err) => console.log(err));
</script>

<template>
  <div class="pl-12">
    <p class="text-grey uppercase font-light text-xl">Amp preset:</p>
    <p class="font-black uppercase text-2xl">{{ song.preset.name }}</p>
  </div>
</template>
