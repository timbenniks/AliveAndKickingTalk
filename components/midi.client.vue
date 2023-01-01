<script setup lang="ts">
import { WebMidi } from "webmidi";
WebMidi.enable()
  .then(() => {
    const output = WebMidi.getOutputByName("IAC Driver Alive and Kicking");
    output.channels[1].sendProgramChange(0);
  })
  .catch((err) => console.log(err));
</script>

<template>
  <h1>ss</h1>
</template>
