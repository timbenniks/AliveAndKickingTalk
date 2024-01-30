<script setup lang="ts">
import { createMashupImage, createShareImage } from "~/helpers";
import type { Database, Song } from "~/types";

const client = useSupabaseClient<Database>();

const route = useRoute();
const { id } = route.params;

const songStore = useSongStore();
await songStore.getSongs();

const { allSongs } = storeToRefs(songStore);
const url = ref();
const selectedSong = ref();
const artist = ref();
const songTitle = ref();

const { data: share } = await client
  .from("shares")
  .select("*")
  .eq("id", id)
  .single();

if (!share) {
  throw createError({
    statusCode: 500,
    statusMessage: `No sharing info found`,
  });
}

if (share?.mashup) {
  url.value = await createMashupImage(
    share.user_avatar as string,
    allSongs,
    share.songids
  );
} else {
  selectedSong.value = songStore.getSongById(share?.songids as string);
  url.value = await createShareImage(
    share.user_avatar,
    selectedSong.value as Song
  );

  artist.value = selectedSong?.value.artist.replace("/", "%2F");
  songTitle.value = selectedSong?.value.song;
}

const { conference } = useRuntimeConfig().public;

const seoOptions: any = {
  description: "Alive and Kicking, a Vue into Rock & Roll",
  ogDescription: "Alive and Kicking, a Vue into Rock & Roll",
  ogImage: url.value,
  ogImageWidth: 1920,
  ogImageHeight: 1080,
  twitterCard: "summary_large_image",
  twitterImage: url.value,
};

if (share?.mashup) {
  seoOptions.title = `This is my mashup at Tim Benniks' talk at ${conference}`;
  seoOptions.ogTitle = `This is my mashup at Tim Benniks' talk at ${conference}`;
  seoOptions.twitterTitle = `This is my mashup at Tim Benniks' talk at ${conference}`;
} else {
  seoOptions.title = `I just voted for ${songTitle.value} by ${artist.value} at Tim Benniks' talk at ${conference}`;
  seoOptions.ogTitle = `I just voted for ${songTitle.value} by ${artist.value} at Tim Benniks' talk at ${conference}`;
  seoOptions.twitterTitle = `I just voted for ${songTitle.value} by ${artist.value} at Tim Benniks' talk at ${conference}!`;
}

useSeoMeta(seoOptions);
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
