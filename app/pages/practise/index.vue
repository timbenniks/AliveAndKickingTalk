<script setup lang="ts">
import { storeToRefs } from "pinia";

const songStore = useSongStore();
await songStore.getSongs();

const { allSongs } = storeToRefs(songStore);
</script>

<template>
  <main class="rehearsal">
    <header class="rehearsal-head">
      <p class="rehearsal-kicker">Rehearsal</p>
      <h1 class="rehearsal-title">Pick a song to practise</h1>
      <p class="rehearsal-lede">Play a backing track with the stage, amp presets and guitar input. Nothing here changes the live setlist or the votes.</p>
      <FretStrip />
    </header>
    <ul class="rehearsal-list">
      <li v-for="song in allSongs" :key="song.songId">
        <a :href="`/practise/${song.songId}`" class="rehearsal-song px-frame">
          <img
            :src="song.cover.replace('q_auto,f_auto', 'q_auto,f_auto,w_160,h_160')"
            :alt="`${song.song} cover`"
            width="80"
            height="80"
          >
          <span class="rehearsal-copy">
            <span class="rehearsal-name">{{ song.song }}</span>
            <span class="rehearsal-artist">{{ song.artist }}</span>
          </span>
          <PixelBadge>{{ song.length }}</PixelBadge>
        </a>
      </li>
    </ul>
  </main>
</template>

<style>
.rehearsal { min-height: 100dvh; padding: 2.5rem max(1rem, calc((100% - 1080px) / 2)) 4rem; background: var(--color-night); color: var(--color-bone); font-family: var(--font-sans); }
.rehearsal-head { display: grid; gap: 1rem; margin-bottom: 2.5rem; }
.rehearsal-kicker { font-family: var(--font-caps); font-size: 0.8rem; text-transform: uppercase; color: var(--color-gold); }
.rehearsal-title { font-family: var(--font-pixel); font-size: clamp(2.5rem, 7vw, 4.5rem); line-height: 0.9; }
.rehearsal-lede { max-width: 60ch; font-size: 1.15rem; line-height: 1.4; color: var(--color-dust); }
.rehearsal-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 1.25rem; }
.rehearsal-list > li { display: flex; }
.rehearsal-song {
  --edge: var(--color-tolex-hi);
  display: grid;
  grid-template-columns: 64px 1fr auto;
  gap: 1rem;
  align-items: center;
  width: 100%;
  padding: 0.75rem;
  background: var(--color-tolex);
  color: var(--color-bone);
  text-decoration: none;
}
.rehearsal-song img { width: 64px; height: 64px; object-fit: cover; }
.rehearsal-copy { display: grid; min-width: 0; }
.rehearsal-name { font-family: var(--font-pixel); font-size: 1.6rem; line-height: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rehearsal-artist { color: var(--color-dust); }
.rehearsal-song:hover, .rehearsal-song:focus-visible { --edge: var(--color-gold); }
.rehearsal-song:focus-visible { outline: var(--px) solid var(--color-fret-4); outline-offset: calc(var(--px) * 2); }
</style>
