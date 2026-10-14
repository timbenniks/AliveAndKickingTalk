<script setup lang="ts">
// Dev only: the real vote screen with votes kept in this tab. Tapping behaves
// like the live app (including network latency) but nothing reaches Supabase.
if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: "Page not found" });

const songStore = useSongStore();
await songStore.getSongs();
songStore.songs.forEach(song => { song.voted = false; });

// Same network feel as the live app, but the write stays in this tab.
songStore.writeVote = async () => { await new Promise(resolve => setTimeout(resolve, 400)); };
songStore.setVotedState = async () => undefined;

// A pretend signed-in voter so the share UI renders. Never press Share here:
// that would write a real share row.
useSupabaseUser().value = { sub: "preview-voter", user_metadata: { avatar_url: "https://github.com/timbenniks.png" } } as never;
</script>

<template>
  <regular-vote />
</template>
