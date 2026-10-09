<script setup lang="ts">
import { storeToRefs } from "pinia";
import {
  mergePlayedSongsWithAllSongs,
} from "~/helpers";

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
    return mergePlayedSongsWithAllSongs(allSongs, allPlayedSongs);
  } else {
    return allSongs.value.toSorted((a, b) => b.votes - a.votes);
  }
});
</script>

<template>
  <main>
    <p role="status" class="fixed bottom-2 left-2 z-50 bg-black/80 px-2 text-xs">{{ realtimeStatus }}</p>
    <live-vote-overview :songs="songs" :mashup-mode="mashupMode" />
  </main>
</template>
