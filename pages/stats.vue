<script setup lang="ts">
import type { Database } from "../types";

const client = useSupabaseClient<Database>();
const { plausibleKey } = useRuntimeConfig().public;

const { data, refresh } = await useAsyncData("stats", async () => {
  const { data: activeSong } = await client
    .from("config")
    .select("*")
    .eq("key", "active_song")
    .single();

  const song = activeSong.val;

  const aggregate = await $fetch(
    "https://plausible.io/api/v1/stats/aggregate?site_id=aliveandkicking.dev&period=day&metrics=visitors,pageviews,bounce_rate,visit_duration",
    {
      headers: {
        Authorization: `Bearer ${plausibleKey}`,
      },
    }
  );

  const liveCount = await $fetch(
    "https://plausible.io/api/v1/stats/realtime/visitors?site_id=aliveandkicking.dev",
    {
      headers: {
        Authorization: `Bearer ${plausibleKey}`,
      },
    }
  );

  const { data: votesPerSong, error: errorVotesPerSong } = await client
    .from("votes_per_song")
    .select("*");

  const { count: votesCount } = await client
    .from("votes")
    .select("*", { count: "exact", head: true });

  const users = await $fetch("/api/users");

  return {
    song,
    aggregate,
    votesCount,
    liveCount,
    votesPerSong,
    users,
  };
});

//setInterval(refresh, 10000);
</script>

<template>
  <pre v-if="data?.song !== 'none'">{{ data }}</pre>
  <template v-else>
    <img
      src="/logo.png"
      alt="Alive & Kicking"
      class="absolute top-2/4 left-2/4 -translate-x-2/4 -translate-y-2/4 w-[700px] z-20"
    />
  </template>
</template>
