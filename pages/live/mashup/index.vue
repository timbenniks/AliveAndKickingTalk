<script setup lang="ts">
import { storeToRefs } from "pinia";

const songStore = useSongStore();
await songStore.getSongs();

const { allSongs } = storeToRefs(songStore);

setInterval(async () => {
  await songStore.getVotesForSongs();
}, 5000);

await songStore.getVotesForSongs();

const songs = computed(() => {
  return allSongs.value.sort((a, b) => b.votes - a.votes).slice(0, 4);
});
</script>
<template>
  <live-votes class="z-10 absolute w-screen pointer-events-none" />
  <img
    src="/logo.png"
    alt="Alive & Kicking"
    class="absolute bottom-8 right-8 md:w-48 w-36"
  />
  <img
    src="/vueamsterdam.png"
    alt="Vue Amsterdam"
    class="absolute w-48 md:left-8 md:bottom-8 md:top-auto left-2/4 -translate-x-2/4 md:-translate-x-0 top-4"
  />
  <section class="grid grid-cols-2 grid-rows-2 w-screen h-screen">
    <div v-for="(song, index) in songs">
      {{ index + 1 }}: {{ song.songId }} - {{ song.votes }}
    </div>
  </section>
</template>
