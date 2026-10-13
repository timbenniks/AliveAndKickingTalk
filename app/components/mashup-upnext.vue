<script lang="ts" setup>
import type { Song } from "~/types";
defineProps<{ songs: Song[]; currentSong: Song }>();
</script>

<template>
  <section class="upnext">
    <h2 class="upnext-title">Mashup setlist</h2>
    <ol class="mashup-list">
      <li v-for="(song, index) in songs" :key="song.songId">
        <!-- select-song-N is what the player clicks to advance when a song ends. -->
        <a
          :href="`/live/${song.songId}?spot=${index + 1}&autoplay=true`"
          class="mashup-spot px-frame"
          :class="[`select-song-${index + 1}`, { 'is-now': song.songId === currentSong.songId }]"
          :style="{ '--edge': song.songId === currentSong.songId ? 'var(--color-gold)' : 'var(--color-tolex-hi)' }"
          :aria-current="song.songId === currentSong.songId ? 'true' : undefined"
        >
          <span class="mashup-num">{{ index + 1 }}</span>
          <img
            :src="song.cover.replace('q_auto,f_auto', 'q_auto,f_auto,w_200,h_200')"
            :alt="`${song.song} cover`"
            width="96"
            height="96"
          >
          <span class="upnext-copy">
            <span class="upnext-name">{{ song.song }}</span>
            <span class="upnext-artist">{{ song.artist }}</span>
          </span>
          <span class="mashup-votes">{{ song.votes }}</span>
        </a>
      </li>
    </ol>
  </section>
</template>

<style>
.mashup-list { display: grid; gap: 1.25rem; }
.mashup-spot { display: grid; grid-template-columns: auto 72px 1fr auto; gap: 0.75rem; align-items: center; padding: 0.5rem; background: var(--color-tolex); color: var(--color-bone); text-decoration: none; }
.mashup-spot img { width: 72px; height: 72px; object-fit: cover; }
.mashup-num { font-family: var(--font-caps); font-size: 0.8rem; color: var(--color-dust); }
.mashup-votes { font-family: var(--font-pixel); font-size: 2.5rem; line-height: 1; color: var(--color-gold); }
.mashup-spot.is-now { background: var(--color-gold); color: var(--color-ink); }
.mashup-spot.is-now .upnext-artist, .mashup-spot.is-now .mashup-num, .mashup-spot.is-now .mashup-votes { color: var(--color-ink); }
</style>
