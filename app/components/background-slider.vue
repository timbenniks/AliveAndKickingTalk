<script setup lang="ts">
const props = defineProps<{ song: { artwork: { bg: string; x: string; y: string }[] }; timeout?: number }>();

function randomIntFromInterval(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

const background = ref(
  props.song.artwork[randomIntFromInterval(0, props.song.artwork.length - 1)]
);

let timer: ReturnType<typeof setInterval>;
onMounted(() => {
timer = setInterval(() => {
  background.value =
    props.song.artwork[randomIntFromInterval(0, props.song.artwork.length - 1)];
}, props.timeout || 10000);
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <Transition>
    <div
      v-if="background"
      :key="background?.bg"
      class="bg-cover w-screen h-screen absolute left-0 top-0"
      :style="{
        backgroundImage: `url(${background.bg.replace(
          'q_auto,f_auto',
          'q_auto,f_auto,w_1920,h_1080,c_fill,g_auto'
        )})`,
        backgroundPositionY: background.y,
      }"
    />
  </Transition>
</template>

<style lang="postcss">
.v-enter-active,
.v-leave-active {
  transition: opacity 1s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
