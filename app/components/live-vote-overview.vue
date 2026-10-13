<script setup lang="ts">
import type { Song } from "~/types";
defineProps<{ songs: Song[]; mashupMode?: boolean }>();
</script>

<template>
  <section class="overview" :class="{ 'overview-mashup': mashupMode }">
    <header class="overview-head">
      <h1 class="overview-title">{{ mashupMode ? "Vote for the mashup" : "Vote for the next anthem" }}</h1>
      <p class="overview-url">aliveandkicking.dev</p>
    </header>
    <ol class="overview-grid">
      <li v-for="(song, index) in songs" :key="song.songId">
        <a
          :href="mashupMode ? `/live/${song.songId}?spot=${index + 1}` : `/live/${song.songId}`"
          class="overview-song px-frame"
          :class="{ 'is-blocked': song.blocked, 'is-leading': !mashupMode && index === 0 && song.votes > 0 }"
        >
          <span
            v-if="!song.blocked && song.artwork[0]?.bg"
            class="overview-art"
            :style="{ backgroundImage: `url(${song.artwork[0].bg})` }"
            aria-hidden="true"
          />
          <img
            :src="song.cover.replace('q_auto,f_auto', 'q_auto,f_auto,w_380,h_380')"
            :alt="`${song.song} cover`"
            width="190"
            height="190"
            class="overview-cover"
          >
          <span class="overview-copy">
            <PixelBadge v-if="mashupMode">Spot {{ index + 1 }}</PixelBadge>
            <span class="overview-name">{{ song.song }}</span>
            <span class="overview-artist">{{ song.artist }}</span>
          </span>
          <span class="overview-votes">
            <span v-if="song.blocked" class="overview-locked">Played</span>
            <span class="overview-count">{{ song.votes }}</span>
            <span class="overview-unit">{{ song.votes === 1 ? "vote" : "votes" }}</span>
          </span>
        </a>
      </li>
    </ol>
  </section>
  <live-votes class="overview-balls" />
</template>

<style>
.overview {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-height: 100dvh;
  padding: 2rem max(1.5rem, 2.5vw) 2.5rem;
  background: var(--color-night);
  color: var(--color-bone);
  font-family: var(--font-sans);
}
.overview-head { display: flex; align-items: baseline; justify-content: space-between; gap: 2rem; flex-wrap: wrap; }
.overview-title { font-family: var(--font-pixel); font-size: clamp(2.5rem, 4vw, 4.5rem); line-height: 0.9; }
.overview-url { font-family: var(--font-caps); font-size: clamp(0.9rem, 1.3vw, 1.4rem); text-transform: uppercase; color: var(--color-gold); }

.overview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 400px), 1fr)); gap: 1.5rem; }
.overview-mashup .overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); flex: 1; }
.overview-grid > li { display: flex; }

.overview-song {
  --edge: var(--color-tolex-hi);
  position: relative;
  /* Cover on the left; the title gets the full width and the count sits under it. */
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas: "cover copy" "cover votes";
  column-gap: 1.5rem;
  row-gap: 0.75rem;
  align-items: start;
  width: 100%;
  padding: 1.25rem;
  overflow: hidden;
  background: var(--color-tolex);
  color: var(--color-bone);
  text-decoration: none;
}
.overview-song.is-leading { --edge: var(--color-gold); }
.overview-song.is-blocked { opacity: 0.45; }
.overview-song:focus-visible { outline: var(--px) solid var(--color-fret-4); outline-offset: calc(var(--px) * 2); }
.overview-art { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0.22; }
.overview-cover, .overview-copy, .overview-votes { position: relative; }
.overview-cover { grid-area: cover; align-self: center; }
.overview-copy { grid-area: copy; }
.overview-votes { grid-area: votes; }
.overview-cover { width: clamp(96px, 8vw, 150px); height: auto; aspect-ratio: 1; object-fit: cover; box-shadow: var(--px) var(--px) 0 var(--color-ink); }
.overview-mashup .overview-cover { width: clamp(120px, 12vw, 240px); }
.overview-copy { display: grid; gap: 0.5rem; justify-items: start; min-width: 0; }
.overview-name { font-family: var(--font-pixel); font-size: clamp(1.75rem, 2.4vw, 3rem); line-height: 0.95; }
.overview-artist { font-size: clamp(1.1rem, 1.4vw, 1.6rem); color: var(--color-dust); }
.overview-votes { display: flex; align-items: baseline; justify-content: flex-end; gap: 0.75rem; align-self: end; }
.overview-count { font-family: var(--font-pixel); font-size: clamp(3rem, 5vw, 6.5rem); line-height: 0.8; color: var(--color-gold); }
.overview-unit, .overview-locked { font-family: var(--font-caps); font-size: clamp(0.75rem, 1vw, 1rem); text-transform: uppercase; color: var(--color-dust); }
.overview-locked { color: var(--color-fret-2); margin-right: auto; }
.overview-balls { position: fixed; inset: 0; z-index: 2; pointer-events: none; }

@media (max-width: 700px) {
  .overview-mashup .overview-grid { grid-template-columns: 1fr; }

}
</style>
