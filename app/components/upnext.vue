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
            width="64"
            height="64"
          >
          <span class="upnext-copy">
            <span class="upnext-name">{{ song.song }}</span>
            <span class="upnext-artist">{{ song.artist }}</span>
          </span>
          <PixelBadge>{{ song.votes }} {{ song.votes === 1 ? 'vote' : 'votes' }}</PixelBadge>
        </a>
      </li>
    </ol>
  </section>
</template>

<style>
.upnext { padding: 1rem; }
.upnext-title { font-family: var(--font-pixel); font-size: 2.25rem; line-height: 1; margin-bottom: 1rem; }
.upnext-list { display: grid; gap: 0.75rem; }
.upnext-song { display: grid; grid-template-columns: 64px 1fr auto; gap: 0.75rem; align-items: center; text-decoration: none; color: var(--color-bone); }
.upnext-song img { width: 64px; height: 64px; object-fit: cover; box-shadow: var(--px) var(--px) 0 var(--color-ink); }
.upnext-copy { display: grid; min-width: 0; }
.upnext-name { font-family: var(--font-pixel); font-size: 1.35rem; line-height: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.upnext-artist { color: var(--color-dust); font-size: 0.95rem; }
.upnext-song:hover .upnext-name, .upnext-song:focus-visible .upnext-name { color: var(--color-gold); }
</style>
