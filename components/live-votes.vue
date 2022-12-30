<script setup lang="ts">
import type { RealtimeChannel } from "@supabase/supabase-js";
const client = useSupabaseClient();
let realtimeChannel: RealtimeChannel;

const { data: votes, refresh: refreshVotes } = await useAsyncData(
  "votes",
  async () => {
    const { data } = await client.from("votes").select("userid, user_avatar");
    return data;
  }
);

onMounted(() => {
  realtimeChannel = client
    .channel("public:votes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "votes" },
      () => refreshVotes()
    );

  realtimeChannel.subscribe();
});

onUnmounted(() => {
  client.removeChannel(realtimeChannel);
});
</script>

<template>
  <pre>{{ votes }}</pre>
</template>
