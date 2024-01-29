<script setup lang="ts">
import { createShareImage } from "../../helpers";
import type { Song } from "../../types";
import { useSongStore } from "~/store/songs";

const route = useRoute();
const { song } = route.params;
const { userid } = route.query;

const songStore = useSongStore();
await songStore.getSongs();
await songStore.getConfigValues();

const selectedSong = songStore.getSongById(song as string);
const { conference } = useRuntimeConfig().public;

const artist = selectedSong?.artist.replace("/", "%2F");
const songTitle = selectedSong?.song;

const url = await createShareImage(
  userid as string,
  song as string,
  selectedSong as Song
);

useSeoMeta({
  title: `I just voted for ${songTitle} by ${artist} at Tim Benniks' talk at ${conference}`,
  ogTitle: `I just voted for ${songTitle} by ${artist} at Tim Benniks' talk at ${conference}`,
  description: "Alive and Kicking, a Vue into Rock & Roll",
  ogDescription: "Alive and Kicking, a Vue into Rock & Roll",
  ogImage: url,
  ogImageWidth: 1920,
  ogImageHeight: 1080,
  twitterTitle: `I just voted for ${songTitle} by ${artist} at Tim Benniks' talk at ${conference}!`,
  twitterImage: url,
  twitterCard: "summary_large_image",
});
</script>

<template>
  <main class="max-w-7xl mx-auto p-12">
    <h1
      class="uppercase font-black text-4xl md:text-5xl mb-2 flowing-title inline-block"
    >
      I just voted!
    </h1>
    <h2 class="block uppercase font-light text-2xl md:text-3xl mb-4">
      Alive and Kicking, a Vue into Rock & Roll
    </h2>

    <img
      :src="url"
      :alt="`I just voted for ${songTitle} by ${artist} at Tim Benniks' talk at ${conference}`"
      class="w-full block fancy-image mb-4 aspect-video"
      loading="eager"
      width="1920"
      height="1080"
    />

    <article class="max-w-3xl text-xl">
      <h3 class="uppercase font-black text-3xl mb-4 flowing-title inline-block">
        Rock & Roll in the browser
      </h3>
      <p class="mb-4">
        Get ready to rock out at your next tech conference! I've created an
        electrifying browser-based karaoke experience tailored explicitly for
        rock & roll guitar. Using the innovative power of Vue, Nuxt, and
        webmidi, everything from the backing tracks to the guitar amp presets is
        dynamically controlled.
      </p>
      <p class="mb-4">
        And the best part? You, the audience, get to participate too! By logging
        in with Twitter or Github, you can live-vote what songs I should play
        next, making this a fully interactive and unforgettable experience.
      </p>

      <p>
        Learn more about
        <a href="https://timbenniks.dev/alive-and-kicking" target="_blank"
          >this talk</a
        >.
      </p>
    </article>
  </main>
</template>
