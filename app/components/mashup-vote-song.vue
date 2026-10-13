<script setup lang="ts">
import type { PlayedSong, Song } from "~/types";

// `next` marks the first open spot; it gets the one gold button on the screen.
const props = defineProps<{ song?: Song; spot: number; next?: boolean; voting: boolean; playedSongs: PlayedSong[]; allSongs: Song[] }>();
const emit = defineEmits<{ (e: 'openSongSelect' | 'removeVote', spot: number): void }>();

const blocked = computed(() => {
  return props.playedSongs.find(
    (playedSong: PlayedSong) => playedSong.mashupSpot === props.spot
  );
});

const blockedSong = computed(() => {
  return props.allSongs.find(
    (song: Song) => song.songId === blocked.value?.songId
  );
});

function openSongSelect() {
  emit("openSongSelect", props.spot);
}

function removeVote() {
  emit("removeVote", props.spot);
}
</script>

<template>
  <li class="mashup-spot-item">
    <PixelPanel v-if="blocked" class="mashup-spot mashup-spot-locked" tag="div">
      <p class="mashup-spot-label">Spot {{ spot }} · Played</p>
      <div class="mashup-spot-song">
        <img
          :src="blockedSong?.cover.replace('q_auto,f_auto', 'q_auto,f_auto,w_380,h_380')"
          :alt="`${blockedSong?.song} by ${blockedSong?.artist}, cover`"
          width="96"
          height="96"
        >
        <div class="mashup-spot-copy">
          <p class="mashup-spot-name">{{ blockedSong?.song }}</p>
          <p class="mashup-spot-artist">{{ blockedSong?.artist }}</p>
        </div>
      </div>
      <p class="mashup-spot-note">Tim already played this spot, so it is locked.</p>
      <SongShare nativecopy="Share" :song="blockedSong" :mashup="false" />
    </PixelPanel>

    <PixelPanel v-else-if="song" class="mashup-spot" tag="div" :fret="spot">
      <div
        class="mashup-spot-art"
        :style="{ backgroundImage: `url(${song.artwork[2]?.bg || song.artwork[0]?.bg || song.cover})` }"
        aria-hidden="true"
      />
      <p class="mashup-spot-label">Spot {{ spot }}</p>
      <div class="mashup-spot-song">
        <img
          :src="song?.cover.replace('q_auto,f_auto', 'q_auto,f_auto,w_380,h_380')"
          :alt="`${song?.song} by ${song?.artist}, cover`"
          width="96"
          height="96"
        >
        <div class="mashup-spot-copy">
          <p class="mashup-spot-name">{{ song?.song }}</p>
          <p class="mashup-spot-artist">{{ song?.artist }}</p>
        </div>
      </div>
      <div class="mashup-spot-actions">
        <PixelButton variant="secondary" @click="openSongSelect()">Change</PixelButton>
        <PixelButton variant="secondary" :disabled="voting" @click="removeVote()">Remove</PixelButton>
        <SongShare nativecopy="Share" :song="song" :mashup="false" />
      </div>
    </PixelPanel>

    <PixelPanel v-else class="mashup-spot mashup-spot-empty" tag="div">
      <p class="mashup-spot-label">Spot {{ spot }}</p>
      <p class="mashup-spot-empty-copy">Empty</p>
      <PixelButton :variant="next ? 'primary' : 'secondary'" @click="openSongSelect()">Pick a song</PixelButton>
    </PixelPanel>
  </li>
</template>

<style>
.mashup-spot-item { display: flex; }
.mashup-spot {
  position: relative;
  overflow: hidden;
  width: 100%;
  display: grid;
  gap: 0.875rem;
  align-content: start;
  justify-items: start;
}
.mashup-spot > *:not(.mashup-spot-art) { position: relative; }
.mashup-spot-art {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: 50%;
  opacity: 0.18;
}
.mashup-spot-label { font-family: var(--font-caps); font-size: 0.7rem; text-transform: uppercase; color: var(--color-gold); }
.mashup-spot-song { display: grid; grid-template-columns: 6rem 1fr; gap: 0.875rem; align-items: center; width: 100%; }
.mashup-spot-song img { width: 6rem; height: 6rem; object-fit: cover; box-shadow: var(--px) var(--px) 0 var(--color-ink); }
.mashup-spot-copy { min-width: 0; }
.mashup-spot-name { font-family: var(--font-pixel); font-size: 1.75rem; line-height: 0.95; }
.mashup-spot-artist { color: var(--color-dust); font-size: 1rem; margin-top: 0.25rem; }
.mashup-spot-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
.mashup-spot-note { color: var(--color-dust); font-size: 0.95rem; }
.mashup-spot-locked { opacity: 0.8; }
.mashup-spot-empty { min-height: 10rem; align-content: center; justify-items: center; text-align: center; background: color-mix(in srgb, var(--color-tolex) 60%, transparent); }
.mashup-spot-empty-copy { font-family: var(--font-pixel); font-size: 2rem; line-height: 1; color: var(--color-dust); }
@media (min-width: 48rem) {
  .mashup-spot-song { grid-template-columns: 9rem 1fr; }
  .mashup-spot-song img { width: 9rem; height: 9rem; }
  .mashup-spot-name { font-size: 2.25rem; }
}
</style>
