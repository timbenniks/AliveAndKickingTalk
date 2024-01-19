<script setup lang="ts">
import type { Song } from "~/types";

const route = useRoute();
const { song } = route.params;
const songStore = useSongStore();
await songStore.getSongs();
await songStore.getConfigValues();

const selectedSong = songStore.getSongById(song as string);
</script>

<template>
  <main>
    <backgrond-slider :song="selectedSong" class="z-0" />
    <live-votes class="z-10 absolute w-screen" />

    <div class="grid grid-cols-7 h-screen w-screen relative z-20">
      <div class="col-span-5 relative">
        <song-details :song="selectedSong" />
        <player :song="(selectedSong as Song)" />
        <img
          src="/logo.png"
          alt="Alive & Kicking"
          class="absolute bottom-24 right-4 w-48 z-20"
        />
      </div>
      <div class="bg-black bg-opacity-60 col-span-2 p-4">
        <h2 class="font-black text-4xl uppercase mb-8">Up Next</h2>
        <upnext :song="selectedSong" />
      </div>
    </div>
  </main>
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
