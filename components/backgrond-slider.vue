<script setup lang="ts">
const props = defineProps(["song"]);

function randomIntFromInterval(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

type artwork = {
  bgX: string;
  bgY: string;
  bg: string;
};

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
        backgroundImage: `url(${background.bg})`,
        backgroundPositionY: background.bgY,
      }"
    ></div>
  </Transition>
</template>
