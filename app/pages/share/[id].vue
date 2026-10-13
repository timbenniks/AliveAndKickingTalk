<script setup lang="ts">
import { createMashupImage, createShareImage } from "#shared/utils/images";
import type { Database, Song } from "~/types";

const client = useSupabaseClient<Database>();

const route = useRoute();
const { id } = route.params;
if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) {
  throw createError({ statusCode: 404, statusMessage: "Share not found" });
}

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
  .eq("id", Number(id))
  .single();

if (!share) {
  throw createError({
    statusCode: 404,
    statusMessage: `No sharing info found`,
  });
}

if (share?.mashup) {
  url.value = await createMashupImage(
    share.user_avatar as string,
    allSongs.value,
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

const seoOptions: Parameters<typeof useSeoMeta>[0] = {
  description: "Alive and Kicking: Rock Anthem Edition. You vote, Tim plays.",
  ogDescription: "Alive and Kicking: Rock Anthem Edition. You vote, Tim plays.",
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
  <main class="share-page">
    <p class="share-eyebrow">Alive and Kicking: Rock Anthem Edition</p>
    <h1 class="share-title">
      <template v-if="share?.mashup">I picked a mashup for the show</template>
      <template v-else>I voted for {{ songTitle }}</template>
    </h1>

    <img
      :src="url"
      :alt="share?.mashup ? `My mashup picks for Tim Benniks' talk at ${conference}` : `My vote for ${songTitle} at Tim Benniks' talk at ${conference}`"
      class="share-image px-frame"
      loading="eager"
      width="1920"
      height="1080"
    >

    <article class="share-copy">
      <h2>Rock and roll in the browser</h2>
      <p>
        Alive and Kicking is a conference talk with a live soundtrack. The
        audience votes on their phones, Tim plays guitar live, and the browser
        runs everything else: backing tracks, amp changes and a voxel stage
        built with Vue, Nuxt and three.js.
      </p>
      <p>
        At the show you sign in with GitHub, Twitter or LinkedIn to vote, and
        your profile picture dives into the crowd on the big screen.
      </p>
      <p>
        <a href="https://timbenniks.dev/alive-and-kicking" target="_blank" rel="noopener noreferrer">
          More about the talk <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </article>
  </main>
</template>

<style>
.share-page {
  min-height: 100dvh;
  max-width: 80rem;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
  background: var(--color-night);
  color: var(--color-bone);
  font-family: var(--font-sans);
}
.share-eyebrow { font-family: var(--font-caps); font-size: 0.7rem; text-transform: uppercase; color: var(--color-gold); margin-bottom: 0.75rem; }
.share-title { font-family: var(--font-pixel); font-weight: 400; font-size: clamp(2.5rem, 8vw, 4.5rem); line-height: 0.9; margin-bottom: 1.75rem; }
.share-image { --edge: var(--color-tolex-hi); display: block; width: calc(100% - 2 * var(--px)); height: auto; aspect-ratio: 16 / 9; margin-bottom: 2.5rem; }
.share-copy { max-width: 42rem; display: grid; gap: 1rem; font-size: 1.15rem; line-height: 1.55; color: var(--color-dust); }
.share-copy h2 { font-family: var(--font-pixel); font-weight: 400; font-size: 2.25rem; line-height: 1; color: var(--color-bone); }
.share-copy a { color: var(--color-bone); text-underline-offset: 4px; }
.share-copy a:hover { color: var(--color-gold); }
.share-copy a:focus-visible { outline: var(--px) solid var(--color-fret-4); outline-offset: var(--px); }
@media (min-width: 48rem) { .share-page { padding: 3rem 2rem 5rem; } }
</style>
