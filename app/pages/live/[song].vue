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
// Only the host may move the show along. Anyone else still gets the stage.
const isHost = await songStore.setConfigValue("active_song", song as string)
  .then(() => true, () => { songStore.errorMessage = ""; return false; });

if (spot && isHost) {
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
    <p role="status" class="live-status">{{ realtimeStatus }}<template v-if="!isHost"> · Not signed in as host: this screen does not change the active song</template></p>
    <stage-player :song="selectedSong" :mashup-mode="mashupMode" :host="isHost" live />
  </div>
</template>

<style>
.live-status { position: fixed; top: 0.5rem; right: 0.5rem; z-index: 50; font-family: var(--font-caps); font-size: 0.6rem; text-transform: uppercase; color: var(--color-dust); }
</style>
