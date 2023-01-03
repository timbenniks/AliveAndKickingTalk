<script setup lang="ts">
const props = defineProps(["song"]);

function randomIntFromInterval(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

type artwork = {
  bgX: string;
  bg: string;
};

const backgrounds = props.song.artwork.map((art: artwork) => {
  return art.bg;
});

const background = ref(
  backgrounds[randomIntFromInterval(0, backgrounds.length - 1)]
);

setInterval(() => {
  background.value =
    backgrounds[randomIntFromInterval(0, backgrounds.length - 1)];
}, 10000);
</script>

<template>
  <Transition>
    <div
      class="bg-cover w-screen h-screen absolute left-0 top-0"
      :key="background"
      :style="{
        backgroundImage: `url(${background})`,
      }"
    ></div>
  </Transition>
</template>
