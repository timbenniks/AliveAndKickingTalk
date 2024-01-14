<script setup lang="ts">
const props = defineProps(["song"]);

function randomIntFromInterval(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

const background = ref(props.song.artwork[0]);

setInterval(() => {
  background.value =
    props.song.artwork[randomIntFromInterval(0, props.song.artwork.length - 1)];
}, 10000);
</script>

<template>
  <Transition>
    <div
      class="bg-cover w-screen h-screen absolute left-0 top-0"
      :key="background"
      :style="{
        backgroundImage: `url(${background.bg.replace(
          'q_auto,f_auto',
          'q_auto,f_auto,w_1920,h_1080,c_crop'
        )})`,
        backgroundPositionY: background.y,
      }"
    ></div>
  </Transition>
</template>
