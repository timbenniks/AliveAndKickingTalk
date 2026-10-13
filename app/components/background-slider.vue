<script setup lang="ts">
type Artwork = { bg: string; x: string; y: string };

// Without a song, the house backdrop: the Alive and Kicking stage photos.
const HOUSE = "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,o_70/Alive%20and%20Kicking/bg";
const houseArtwork: Artwork[] = Array.from({ length: 10 }, (_, i) => ({ bg: `${HOUSE}/${i + 1}.png`, x: "0%", y: "0%" }));

const props = defineProps<{ song?: { artwork: Artwork[] }; timeout?: number }>();
const artwork = computed(() => props.song?.artwork.length ? props.song.artwork : houseArtwork);

function pick() {
  return artwork.value[Math.floor(Math.random() * artwork.value.length)];
}

const background = ref(pick());

let timer: ReturnType<typeof setInterval>;
onMounted(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  timer = setInterval(() => { background.value = pick(); }, props.timeout || 10000);
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div class="backdrop" aria-hidden="true">
    <Transition name="backdrop-fade">
      <div
        v-if="background"
        :key="background.bg"
        class="backdrop-plate"
        :style="{
          backgroundImage: `url(${background.bg.replace('q_auto,f_auto', 'q_auto,f_auto,w_1920,h_1080,c_fill,g_auto')})`,
          backgroundPositionY: background.y,
        }"
      />
    </Transition>
    <div class="backdrop-shade" />
  </div>
</template>

<style>
.backdrop { position: fixed; inset: 0; overflow: hidden; background: var(--color-night); }
.backdrop-plate { position: absolute; inset: 0; background-size: cover; opacity: 0.55; }
/* Stage haze over the photo so text on top always reads. */
.backdrop-shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(to top, var(--color-night) 0%, transparent 55%),
    linear-gradient(to right, color-mix(in srgb, var(--color-night) 70%, transparent), transparent 60%);
}
.backdrop-fade-enter-active, .backdrop-fade-leave-active { transition: opacity 1s linear; }
.backdrop-fade-enter-from, .backdrop-fade-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .backdrop-fade-enter-active, .backdrop-fade-leave-active { transition: none; }
}
</style>
