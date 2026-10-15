<script setup lang="ts">
import { storeToRefs } from "pinia";
import { buildSetlist } from "#shared/utils/performance";

const songStore = useSongStore();
await songStore.getSongs();
await songStore.getVotesForSongs();
await songStore.getPlayedSongs();
await songStore.getConfigValues();

const { allSongs, configValues, allPlayedSongs } = storeToRefs(songStore);

const realtimeStatus = useLiveVotes("live-index");

const mashupMode = computed(() => {
  const mashupModeConfKey = configValues.value.find(
    (config) => config.key === "mashup_mode"
  );

  if (mashupModeConfKey) {
    return mashupModeConfKey.val === "true";
  }
  return false;
});

const songs = computed(() => {
  if (mashupMode.value) {
    return buildSetlist(allSongs.value, allPlayedSongs.value);
  } else {
    return allSongs.value.toSorted((a, b) => b.votes - a.votes);
  }
});
</script>

<template>
  <main>
    <p role="status" class="overview-status">{{ realtimeStatus }}</p>
    <live-vote-overview :songs="songs" :mashup-mode="mashupMode" />
  </main>
</template>

<style>
.overview-status { position: fixed; right: 0.75rem; bottom: 0.5rem; z-index: 50; font-family: var(--font-caps); font-size: 0.6rem; text-transform: uppercase; color: var(--color-dust); }
</style>
