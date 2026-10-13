<script setup lang="ts">
import type { Database } from "../types";

const client = useSupabaseClient<Database>();

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

  const song = activeSong?.val;
  const liveCount = await $fetch('/api/visitors');

  const { data: votesPerSong } = await client
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

let timer: ReturnType<typeof setInterval>;
onMounted(() => { timer = setInterval(() => refresh(), 10000); });
onUnmounted(() => clearInterval(timer));

const coverFor = (songId: string | null) =>
  allSongs.value.find(song => song.songId === songId)?.cover.replace("q_auto,f_auto", "q_auto,f_auto,w_240,h_240") || "";
</script>

<template>
  <main class="stats">
    <template v-if="data?.song !== 'none'">
      <header class="stats-head">
        <PixelLabel text="Alive and Kicking" :scale="4" :max-cols="20" />
        <p>Rock Anthem edition</p>
      </header>

      <div class="stats-board">
        <section class="stats-tile stats-qr px-frame">
          <h2 class="stats-label">Scan to vote</h2>
          <qr class="stats-qr-code" />
          <p class="stats-url">aliveandkicking.dev</p>
        </section>
        <section class="stats-tile px-frame">
          <h2 class="stats-label">Votes</h2>
          <p class="stats-number">{{ data?.votesCount ?? "—" }}</p>
        </section>
        <section class="stats-tile px-frame">
          <h2 class="stats-label">Online now</h2>
          <p class="stats-number">{{ data?.liveCount ?? "—" }}</p>
        </section>
        <section class="stats-tile stats-songs px-frame">
          <h2 class="stats-label">Votes per song</h2>
          <ul class="stats-song-grid">
            <li v-for="vote in data?.votesPerSong" :key="(vote.songid as string)" class="stats-song">
              <img :src="coverFor(vote.songid)" alt="" width="120" height="120">
              <span>{{ vote.votes }}</span>
            </li>
          </ul>
        </section>
      </div>

      <section class="stats-people">
        <h2 class="stats-label">People ({{ data?.users.length ?? 0 }})</h2>
        <ul class="stats-faces">
          <li v-for="(user, index) in data?.users" :key="`${index}-${user}`">
            <PixelAvatar :src="user" :size="32" />
          </li>
        </ul>
      </section>
    </template>
    <template v-else>
      <background-slider :timeout="10000" />
      <div class="stats-idle">
        <PixelLabel text="Alive and Kicking" :scale="10" :max-cols="20" />
        <p>Rock Anthem edition</p>
      </div>
    </template>
  </main>
</template>

<style>
.stats {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  height: 100dvh;
  overflow: hidden;
  padding: 2rem max(1.5rem, 2.5vw);
  background: var(--color-night);
  color: var(--color-bone);
  font-family: var(--font-sans);
}
.stats-head { display: flex; align-items: center; gap: 1.25rem; }
.stats-head p, .stats-idle p { font-family: var(--font-caps); text-transform: uppercase; color: var(--color-gold); }
.stats-board { display: grid; grid-template-columns: auto 1fr 1fr 1.6fr; gap: 1.75rem; align-items: stretch; }
.stats-tile { --edge: var(--color-tolex-hi); display: grid; align-content: start; gap: 0.75rem; padding: 1.25rem 1.5rem; background: var(--color-tolex); }
.stats-label { font-family: var(--font-caps); font-size: clamp(0.8rem, 1vw, 1.05rem); text-transform: uppercase; color: var(--color-dust); }
.stats-number { font-family: var(--font-pixel); font-size: clamp(5rem, 9vw, 10rem); line-height: 0.8; color: var(--color-gold); }
.stats-qr { justify-items: center; }
.stats-qr-code { display: block; width: clamp(160px, 13vw, 240px); height: auto; }
.stats-url { font-family: var(--font-caps); font-size: 0.8rem; text-transform: uppercase; color: var(--color-gold); }
.stats-song-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 0.75rem; }
.stats-song { position: relative; }
.stats-song img { display: block; width: 100%; height: auto; aspect-ratio: 1; object-fit: cover; opacity: 0.7; }
.stats-song span { position: absolute; right: 0.375rem; bottom: 0.125rem; font-family: var(--font-pixel); font-size: 2.5rem; line-height: 1; color: var(--color-bone); text-shadow: 3px 3px 0 var(--color-ink); }
.stats-people { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 0.75rem; }
/* The wall of faces fades out at the bottom instead of scrolling the projector. */
.stats-faces {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 6px;
  mask-image: linear-gradient(to bottom, #000 75%, transparent);
}
.stats-idle { position: absolute; inset: 0; z-index: 1; display: grid; place-content: center; justify-items: center; gap: 1.5rem; padding: 1.5rem; }
.stats-idle .pixel-label { max-width: 90vw; }
.stats-idle p { font-size: clamp(1rem, 2vw, 1.75rem); }
@media (max-width: 1100px) {
  .stats { height: auto; min-height: 100dvh; overflow: visible; }
  .stats-board { grid-template-columns: 1fr 1fr; }
}
</style>
