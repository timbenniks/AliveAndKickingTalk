<script setup lang="ts">
import { storeToRefs } from "pinia";

const route = useRoute();
const { song } = route.params;

const songStore = useSongStore();
await songStore.getSongs();
await songStore.getVotesForSongs();
await songStore.getConfigValues();
await songStore.setConfigValue("active_song", song as string);

const selectedSong = songStore.getSongById(song as string);
const { configValues } = storeToRefs(songStore);

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
</script>

<template>
  <song-player :song="selectedSong" :mashup-mode="mashupMode" />
</template>
