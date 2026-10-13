<script setup lang="ts">
const store = useSongStore();
await store.getSongs();
const route = useRoute();
const song = store.getSongById(String(route.params.song));
if (!song) throw createError({ statusCode: 404, statusMessage: 'Song not found' });
</script>

<template>
  <stage-player :song="song" back-to="/practise" />
</template>
