<script setup lang="ts">
const store = useSongStore();
await store.getSongs();
const route = useRoute();
const song = store.getSongById(String(route.params.song));
if (!song) throw createError({ statusCode: 404, statusMessage: 'Song not found' });
</script>

<template>
  <main class="relative min-h-screen">
    <BackgrondSlider :song="song" />
    <div class="relative z-20 min-h-screen pt-4">
      <NuxtLink to="/practise" class="ml-12">← Rehearsal songs</NuxtLink>
      <SongDetails :song="song" />
      <Player :song="song" />
    </div>
  </main>
</template>
