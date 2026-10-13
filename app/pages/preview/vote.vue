<script setup lang="ts">
// Dev only: the real vote screen with votes kept in this tab. Tapping behaves
// like the live app (including the vote delay) but nothing reaches Supabase.
if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: "Page not found" });

const songStore = useSongStore();
await songStore.getSongs();
songStore.songs.forEach(song => { song.voted = false; });

const delay = () => new Promise(resolve => setTimeout(resolve, 400));
songStore.upvote = async (songId: string) => {
  songStore.voting = true;
  await delay();
  const song = songStore.getSongById(songId);
  if (song) song.voted = true;
  songStore.voting = false;
  return true;
};
songStore.downvote = async (songId: string) => {
  songStore.voting = true;
  await delay();
  const song = songStore.getSongById(songId);
  if (song) song.voted = false;
  songStore.voting = false;
  return true;
};
</script>

<template>
  <regular-vote />
</template>
