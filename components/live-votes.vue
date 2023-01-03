<script setup lang="ts">
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Ref } from "vue";

const votez: Ref<HTMLCanvasElement | null> = ref(null);

const client = useSupabaseClient();
let realtimeChannel: RealtimeChannel;

const { data: votes, refresh: refreshVotes } = await useAsyncData(
  "votes",
  async () => {
    const { data } = await client.from("votes").select("userid, user_avatar");
    return data;
  }
);

watch(votes, () => {
  console.log(votes);
});

onMounted(async () => {
  await nextTick();

  realtimeChannel = client
    .channel("public:votes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "votes" },
      () => refreshVotes()
    );

  realtimeChannel.subscribe();

  const ctx = votez.value?.getContext("2d") as CanvasRenderingContext2D;

  if (votez.value) {
    votez.value.width = window.innerWidth;
    votez.value.height = window.innerHeight;
  }

  console.log(ctx);
});

onUnmounted(() => {
  client.removeChannel(realtimeChannel);
});
</script>

<template>
  <canvas ref="votez"></canvas>
</template>
