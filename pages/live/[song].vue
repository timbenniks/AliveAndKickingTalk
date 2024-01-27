<script setup lang="ts">
import { storeToRefs } from "pinia";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createRealtimeChannel, removeRealtimeChannel } from "~/helpers";

const route = useRoute();
const { song } = route.params;
const { spot } = route.query;

const songStore = useSongStore();
await songStore.getSongs();
await songStore.getVotesForSongs();
await songStore.getPlayedSongs();
await songStore.getConfigValues();
await songStore.setConfigValue("active_song", song as string);
await songStore.setPlayedSong(song as string, Number(spot));

const selectedSong = songStore.getSongById(song as string);
const { configValues } = storeToRefs(songStore);

let channel: RealtimeChannel;
onMounted(() => {
  channel = createRealtimeChannel("playing_song_updates", [
    {
      table: "votes",
      event: "INSERT",
      callback: async () => {
        await songStore.getVotesForSongs();
        await songStore.getLatestVote();
      },
    },
    {
      table: "songs_played",
      event: "*",
      callback: async () => {
        await songStore.getPlayedSongs();
      },
    },
  ]);

  channel.subscribe();
});

onUnmounted(() => {
  window.onbeforeunload = null;
});

onBeforeMount(() => {
  window.onbeforeunload = () => {
    removeRealtimeChannel(channel);
  };
});

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
