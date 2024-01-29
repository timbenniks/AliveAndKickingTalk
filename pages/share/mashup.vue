<script setup lang="ts">
import { createMashupImage } from "../../helpers";
import { storeToRefs } from "pinia";
import { useSongStore } from "~/store/songs";

const route = useRoute();
const { userid } = route.query;

const songStore = useSongStore();
await songStore.getSongs();

const { allSongs } = storeToRefs(songStore);
const { conference } = useRuntimeConfig().public;

const url = await createMashupImage(userid as string, allSongs);
useSeoMeta({
  description: "Alive and Kicking, a Vue into Rock & Roll",
  ogDescription: "Alive and Kicking, a Vue into Rock & Roll",
  title: `This is my mashup at Tim Benniks' talk at ${conference}`,
  ogTitle: `This is my mashup at Tim Benniks' talk at ${conference}`,
  ogImage: url,
  ogImageWidth: 1920,
  ogImageHeight: 1080,
  twitterTitle: `This is my mashup at ${conference}`,
  twitterImage: url,
  twitterCard: "summary_large_image",
});
</script>

<template>
  <main class="max-w-7xl mx-auto p-12">
    <h1
      class="uppercase font-black text-4xl md:text-5xl mb-2 flowing-title inline-block"
    >
      I just voted for my favorite mashup!
    </h1>
    <h2 class="block uppercase font-light text-2xl md:text-3xl mb-4">
      Alive and Kicking, a Vue into Rock & Roll
    </h2>

    <img
      :src="url"
      :alt="`This is my mashup at Tim Benniks' talk at ${conference}`"
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
