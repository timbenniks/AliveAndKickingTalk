<script setup lang="ts">
import type { Database } from "../types";

const client = useSupabaseClient<Database>();
const { plausibleKey } = useRuntimeConfig().public;

const songStore = useSongStore();
await songStore.getSongs();
const { allSongs } = storeToRefs(songStore);

const { data, refresh } = await useAsyncData("stats", async () => {
  await songStore.setVotedState();

  const { data: activeSong } = await client
    .from("config")
    .select("*")
    .eq("key", "active_song")
    .single();

  const song = activeSong.val;
  // const aggregate = await $fetch(
  //   "https://plausible.io/api/v1/stats/aggregate?site_id=aliveandkicking.dev&period=day&metrics=visitors,pageviews,bounce_rate,visit_duration",
  //   {
  //     headers: {
  //       Authorization: `Bearer ${plausibleKey}`,
  //     },
  //   }
  // );

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
    votesCount,
    liveCount,
    votesPerSong,
    users,
  };
});

setInterval(refresh, 10000);

const imgBase =
  "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,o_70/Alive%20and%20Kicking/bg";
const bgs = {
  artwork: [
    { bg: `${imgBase}/1.png`, x: "0%", y: "0%" },
    { bg: `${imgBase}/2.png`, x: "0%", y: "0%" },
    { bg: `${imgBase}/3.png`, x: "0%", y: "0%" },
    { bg: `${imgBase}/4.png`, x: "0%", y: "0%" },
    { bg: `${imgBase}/5.png`, x: "0%", y: "0%" },
    { bg: `${imgBase}/6.png`, x: "0%", y: "0%" },
    { bg: `${imgBase}/7.png`, x: "0%", y: "0%" },
    { bg: `${imgBase}/8.png`, x: "0%", y: "0%" },
    { bg: `${imgBase}/9.png`, x: "0%", y: "0%" },
    { bg: `${imgBase}/10.png`, x: "0%", y: "0%" },
  ],
};
</script>

<template>
  <main class="relative w-screen h-screen top-0 left-0">
    <template v-if="data?.song !== 'none'">
      <img
        src="/logo.png"
        alt="Alive & Kicking"
        class="absolute bottom-4 right-4 w-96 z-20"
      />
      <div class="p-8 flex justify-between">
        <section class="votes">
          <p class="uppercase font-light text-3xl mb-4">Link to app</p>
          <qr class="w-36 h-36" />
        </section>
        <section class="votes">
          <p class="uppercase font-light text-3xl">Votes</p>
          <p class="text-9xl font-black flowing-title inline-block">
            {{ data?.votesCount }}
          </p>
        </section>
        <section class="people">
          <p class="uppercase font-light text-3xl">Voters</p>
          <p class="text-9xl font-black flowing-title inline-block">
            {{ data?.liveCount }}
          </p>
        </section>
        <section class="votes-per-song">
          <p class="uppercase font-light text-3xl mb-4">Votes per song</p>

          <ul class="flex space-x-4">
            <li
              v-for="vote in data?.votesPerSong"
              :key="(vote.songid as string)"
            >
              <div class="relative w-28 h-28">
                <img
                  width="144"
                  height="144"
                  class="w-28 mb-4 fancy-image"
                  :src="
                    allSongs
                      .find((song) => song.songId === vote.songid)
                      ?.cover.replace('q_auto,f_auto', 'q_auto,f_auto,o_70')
                  "
                />
                <p
                  class="absolute bottom-2 right-2 text-6xl font-black drop-shadow-xl"
                >
                  {{ vote.votes }}
                </p>
              </div>
            </li>
          </ul>
        </section>
      </div>

      <section class="users p-8">
        <p class="uppercase font-light text-3xl mb-4">
          People ({{ data?.users.length }})
        </p>

        <ul class="flex flex-wrap gap-1">
          <li v-for="user in data?.users" :key="user">
            <img
              :src="user"
              class="rounded-full w-10 h-10"
              width="40"
              height="40"
              loding="lazy"
            />
          </li>
        </ul>
      </section>
    </template>
    <template v-else>
      <backgrond-slider :song="bgs" class="z-0" :timeout="10000" />

      <div
        class="absolute top-2/4 left-2/4 -translate-x-2/4 -translate-y-2/4 z-20 flex flex-col items-center"
      >
        <img src="/logo.png" alt="Alive & Kicking" class="w-[600px]" />
        <img src="/vueamsterdam.png" alt="Vuejs Amsterdam" class="w-[300px]" />
      </div>
    </template>
  </main>
</template>
