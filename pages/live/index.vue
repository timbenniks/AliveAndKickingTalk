<script setup lang="ts">
import type { RealtimeChannel } from "@supabase/supabase-js";
import { storeToRefs } from "pinia";
import {
  mergePlayedSongsWithAllSongs,
  createRealtimeChannel,
  removeRealtimeChannel,
} from "~/helpers";

const songStore = useSongStore();
await songStore.getSongs();
await songStore.getVotesForSongs();
await songStore.getPlayedSongs();
await songStore.getConfigValues();

const { allSongs, configValues, allPlayedSongs } = storeToRefs(songStore);

let channel: RealtimeChannel;
onMounted(() => {
  channel = createRealtimeChannel("live_overview", [
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

const songs = computed(() => {
  if (mashupMode.value) {
    return mergePlayedSongsWithAllSongs(allSongs, allPlayedSongs);
  } else {
    return allSongs.value.sort((a, b) => b.votes - a.votes);
  }
});
</script>

<template>
  <main>
    <live-vote-overview :songs="songs" :mashup-mode="mashupMode" />
  </main>
</template>
