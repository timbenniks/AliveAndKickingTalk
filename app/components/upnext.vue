<script lang="ts" setup>
import type { Song } from "~/types";
defineProps<{ songs: Song[]; currentSong: Song }>();
</script>

<template>
  <section class="upnext">
    <h2 class="upnext-title">Up next</h2>
    <ol class="upnext-list">
      <li v-for="song in songs" :key="song.songId">
        <a :href="`/live/${song.songId}`" class="upnext-song">
          <img
            :src="song.cover.replace('q_auto,f_auto', 'q_auto,f_auto,w_140,h_140')"
            :alt="`${song.song} cover`"
            width="40"
            height="40"
          >
          <span class="upnext-copy">
            <span class="upnext-name">{{ song.song }}</span>
            <span class="upnext-artist">{{ song.artist }}</span>
          </span>
          <span class="upnext-votes" :aria-label="`${song.votes} ${song.votes === 1 ? 'vote' : 'votes'}`">{{ song.votes }}</span>
        </a>
      </li>
    </ol>
  </section>
</template>

<style>
.upnext {
  padding: 0.75rem;
  background: color-mix(in srgb, var(--color-night) 82%, transparent);
  box-shadow: var(--px) var(--px) 0 var(--color-ink);
}
.upnext-title { font-family: var(--font-caps); font-size: 0.7rem; text-transform: uppercase; color: var(--color-gold); margin-bottom: 0.625rem; }
.upnext-list { display: grid; gap: 0.5rem; }
.upnext-song { display: grid; grid-template-columns: 40px 1fr auto; gap: 0.625rem; align-items: center; text-decoration: none; color: var(--color-bone); }
.upnext-song img { width: 40px; height: 40px; object-fit: cover; }
.upnext-copy { display: grid; min-width: 0; }
.upnext-name { font-family: var(--font-pixel); font-size: 1.15rem; line-height: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.upnext-artist { color: var(--color-dust); font-size: 0.8rem; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.upnext-votes { font-family: var(--font-pixel); font-size: 1.5rem; line-height: 1; color: var(--color-gold); min-width: 2ch; text-align: right; }
.upnext-song:hover .upnext-name, .upnext-song:focus-visible .upnext-name { color: var(--color-gold); }
</style>
