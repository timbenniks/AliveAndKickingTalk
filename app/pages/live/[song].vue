<script setup lang="ts">
import { storeToRefs } from "pinia";

const route = useRoute();
const { song } = route.params;
const { spot } = route.query;

const songStore = useSongStore();
await songStore.getSongs();
await songStore.getVotesForSongs();
await songStore.getPlayedSongs();
await songStore.getConfigValues();

const selectedSong = songStore.getSongById(song as string);
if (!selectedSong) throw createError({ statusCode: 404, statusMessage: "Song not found" });
await songStore.setConfigValue("active_song", song as string);

if (spot) {
  await songStore.setPlayedSong(song as string, Number(spot));
}

const { configValues } = storeToRefs(songStore);

const realtimeStatus = useLiveVotes("live-[song]");

const mashupMode = computed(() => {
  const mashupModeConfKey = configValues.value.find(
    (config) => config.key === "mashup_mode"
  );

  if (mashupModeConfKey) {
    return mashupModeConfKey.val === "true";
  }
  return false;
});
</script>

<template>
  <div>
  <p role="status" class="fixed top-2 right-2 z-50 bg-black/80 px-2 text-xs">{{ realtimeStatus }}</p>
  <song-player :song="selectedSong" :mashup-mode="mashupMode" />
  </div>
</template>
