<script setup lang="ts">
import { storeToRefs } from "pinia";

const songStore = useSongStore();
await songStore.getSongs();
await songStore.getVotesForSongs();

const { allSongs } = storeToRefs(songStore);

setInterval(async () => {
  await songStore.getVotesForSongs();
}, 5000);

const songs = computed(() => {
  return allSongs.value.sort((a, b) => b.votes - a.votes).slice(0, 4);
});
</script>
<template>
  <live-votes class="z-20 absolute w-screen pointer-events-none" />

  <section
    class="grid grid-cols-2 grid-rows-2 w-screen h-screen gap-[1px] fancy-bg relative z-10"
  >
    <div
      v-for="(song, index) in songs"
      :style="`background-image: url(${song.artwork[0].bg});`"
      class="bg-cover bg-black relative w-full h-full"
    >
      <a
        :href="`/live/mashup/${song.songId}?spot=${index + 1}`"
        class="p-8 flex justify-between relative w-full h-full no-underline"
      >
        <figure class="flex flex-col">
          <img
            :src="
              song?.cover.replace('q_auto,f_auto', 'q_auto,f_auto,w_380,h_380')
            "
            :alt="`${song?.artist} ${song?.song}`"
            width="100"
            height="100"
            class="w-72 h-72 fancy-image mb-4"
          />
          <figcaption class="block text-left">
            <span class="block uppercase font-black text-3xl">{{
              song?.song
            }}</span>
            <span class="block uppercase font-light text-3xl">{{
              song?.artist
            }}</span>
          </figcaption>
        </figure>
        <div class="text-right">
          <p class="text-[150px] leading-none font-black flowing-title">
            {{ song.votes }}
          </p>
          <p class="uppercase font-light text-3xl">votes</p>
        </div>
      </a>
    </div>
  </section>
  <img
    src="/logo.png"
    alt="Alive & Kicking"
    class="absolute bottom-8 right-8 md:w-48 w-36 z-20"
  />
  <img
    src="/vueamsterdam.png"
    alt="Vue Amsterdam"
    class="z-20 absolute w-48 md:left-8 md:bottom-8 md:top-auto left-2/4 -translate-x-2/4 md:-translate-x-0 top-4"
  />
</template>
