<script setup lang="ts">
import type { Database } from "../types";

const client = useSupabaseClient<Database>();

const { data: song, refresh: refreshSong } = await useAsyncData(
  "song_band",
  async () => {
    const { data } = await client
      .from("config")
      .select("*")
      .eq("key", "active_song")
      .single();

    const songs = await $fetch('/api/songs');
    return songs.find(song => song.songId === data?.val) || false;
  }
);

useDatabaseChanges('config_changes', [{
  table: 'config',
  event: 'UPDATE',
  callback: () => { void refreshSong(); },
}]);
</script>

<template>
  <main class="band">
    <template v-if="song">
      <background-slider :song="song" :timeout="10000" />
      <article class="band-card px-frame">
        <p class="band-kicker">Now on stage</p>
        <h1 class="band-name">{{ song.artist }}</h1>
        <p v-if="song.formed || song.homeTown" class="band-meta">
          <template v-if="song.formed">Formed {{ song.formed }}</template>
          <template v-if="song.formed && song.homeTown"> · </template>
          <template v-if="song.homeTown">{{ song.homeTown }}</template>
        </p>
        <p class="band-bio">{{ song.biography }}</p>
        <img v-if="song.logo" :src="song.logo" :alt="song.artist" class="band-logo" width="1920" height="1080">
      </article>
      <div class="band-brand">
        <PixelLabel text="Alive and Kicking" :scale="4" :max-cols="20" />
        <p>Rock Anthem edition</p>
      </div>
    </template>
    <template v-else>
      <background-slider :timeout="10000" />
      <div class="band-idle">
        <PixelLabel text="Alive and Kicking" :scale="10" :max-cols="20" />
        <p>Rock Anthem edition</p>
      </div>
    </template>
  </main>
</template>

<style>
.band { position: relative; min-height: 100dvh; overflow: hidden; background: var(--color-night); color: var(--color-bone); font-family: var(--font-sans); }
.band-card {
  --edge: var(--color-tolex-hi);
  position: absolute;
  left: max(1.5rem, 2.5vw);
  bottom: max(1.5rem, 2.5vw);
  z-index: 1;
  display: grid;
  gap: 1rem;
  width: min(680px, calc(100vw - 3rem));
  max-height: calc(100dvh - 3rem);
  overflow: auto;
  padding: 1.75rem;
  background: color-mix(in srgb, var(--color-tolex) 92%, transparent);
}
.band-kicker, .band-meta { font-family: var(--font-caps); font-size: 0.9rem; text-transform: uppercase; color: var(--color-gold); }
.band-meta { color: var(--color-dust); }
.band-name { font-family: var(--font-pixel); font-size: clamp(3rem, 5.5vw, 6rem); line-height: 0.85; }
.band-bio { font-size: clamp(1.15rem, 1.35vw, 1.5rem); line-height: 1.4; }
.band-logo { width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: contain; background: var(--color-night); box-shadow: var(--px) var(--px) 0 var(--color-ink); }
.band-brand { position: absolute; right: max(1.5rem, 2.5vw); bottom: max(1.5rem, 2.5vw); z-index: 1; display: grid; justify-items: end; gap: 0.5rem; }
.band-idle { position: absolute; inset: 0; z-index: 1; display: grid; place-content: center; justify-items: center; gap: 1.5rem; padding: 1.5rem; }
.band-brand .pixel-label, .band-idle .pixel-label { max-width: 90vw; }
.band-brand p, .band-idle p { font-family: var(--font-caps); text-transform: uppercase; color: var(--color-gold); }
.band-idle p { font-size: clamp(1rem, 2vw, 1.75rem); }
@media (max-width: 1100px) {
  .band-brand { display: none; }
}
</style>
