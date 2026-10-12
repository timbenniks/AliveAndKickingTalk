<script setup lang="ts">
import { storeToRefs } from "pinia";

const songStore = useSongStore();
await songStore.getSongs();

const { allSongs } = storeToRefs(songStore);
</script>

<template>
  <main class="p-12">
    <h1 class="text-3xl font-black mb-4">Rehearsal</h1>
    <p class="mb-6">Try a backing track and guitar presets without changing the live setlist.</p>
    <ul>
      <li v-for="song in allSongs" :key="song.songId">
        <a :href="`/practise/${song.songId}`">{{ song.song }}</a>
      </li>
    </ul>
  </main>
</template>
