<script setup lang="ts">
import { storeToRefs } from "pinia";

const songStore = useSongStore();
await songStore.getSongs();
await songStore.getVotesForSongs();
await songStore.getConfigValues();

const { allSongs, configValues } = storeToRefs(songStore);

setInterval(async () => {
  await songStore.getVotesForSongs();
}, 5000);

const mashupMode = computed(() => {
  const mashupModeConfKey = configValues.value.find(
    (config) => config.key === "mashup_mode"
  );

  if (mashupModeConfKey) {
    return mashupModeConfKey.val === "true";
  }
});

const songs = computed(() => {
  if (mashupMode.value) {
    return allSongs.value.sort((a, b) => b.votes - a.votes).slice(0, 4);
  } else {
    return allSongs.value.sort((a, b) => b.votes - a.votes);
  }
});
</script>

<template>
  <live-vote-overview :songs="songs" :mashup-mode="mashupMode" />
</template>
