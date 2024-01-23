<script setup lang="ts">
import { storeToRefs } from "pinia";

const songStore = useSongStore();
await songStore.getSongs();

const { allSongs } = storeToRefs(songStore);
</script>

<template>
  <main class="p-12">
    <ul>
      <li v-for="song in allSongs" :key="song.songId">
        <a :href="`/live/${song.songId}`">{{ song.song }}</a>
      </li>
    </ul>
  </main>
</template>
