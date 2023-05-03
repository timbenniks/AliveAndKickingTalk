<script setup lang="ts">
import { constructCloudinaryUrl } from "@cloudinary-util/url-loader";

const route = useRoute();
const { song } = route.params;
const { userid } = route.query;
const client = useSupabaseClient();

const songStore = useSongStore();
const selectedSong = songStore.getSongById(song as string);
const conference = songStore.conference;

const { data: vote } = await client
  .from("votes")
  .select("*")
  .eq("songid", song)
  .eq("userid", userid)
  .single();

const art = selectedSong?.artwork[0].bg.split("o_30/")[1].replace(/%20/g, " ");
// @ts-ignore
const isGithub = !!vote.user_avatar.includes("/u/");
const artist = selectedSong?.artist.replace("/", "%2F");
const songTitle = selectedSong?.song;

const cldOptions = {
  src: art || "",
  width: 1920,
  height: 1080,
  crop: "fill",
  format: "jpg",
  rawTransformations: ["b_black,o_20"],

  overlays: [
    {
      publicId: `Alive and Kicking/overlays_new.png`,
      position: {
        x: 0,
        y: 0,
      },
      effects: [
        {
          width: 1920,
          height: 1080,
        },
      ],
    },
    {
      width: 1400,
      crop: "fit",
      text: {
        color: "white",
        fontFamily: "lato",
        fontSize: 70,
        fontWeight: "black",
        text: artist,
      },
      position: {
        y: 120,
        gravity: "center",
      },
    },
    {
      width: 1400,
      crop: "fit",
      text: {
        color: "white",
        fontFamily: "lato",
        fontSize: 70,
        fontWeight: "light",
        text: songTitle,
      },
      position: {
        y: 195,
        gravity: "center",
      },
    },
  ],
};

if (isGithub) {
  cldOptions.overlays.push({
    // @ts-ignore
    publicId: `github/${vote.user_avatar
      .split("/u/")[1]
      .replace("?v=4", "")
      .replace(".png", "")
      .replace(".jpg", "")}`,
    position: {
      y: -250,
      gravity: "center",
    },
    effects: [
      {
        crop: "fill",
        gravity: "auto",
        width: 250,
        height: 250,
        radius: 1000,
      },
    ],
  });
} else {
  cldOptions.overlays.push({
    // @ts-ignore
    url: vote.user_avatar.replace("_normal", ""),
    position: {
      y: -250,
      gravity: "center",
    },
    effects: [
      {
        crop: "fill",
        gravity: "auto",
        width: 250,
        height: 250,
        radius: 1000,
      },
    ],
  });
}

const url = constructCloudinaryUrl({
  options: cldOptions,
  config: {
    cloud: {
      cloudName: "dwfcofnrd",
    },
  },
});

useSeoMeta({
  description: "Alive and Kicking, a Vue into Rock & Roll",
  ogDescription: "Alive and Kicking, a Vue into Rock & Roll",
  title: `I just voted for ${songTitle?.toLowerCase()} by ${artist?.toLowerCase()} at Tim Benniks' talk at ${conference}`,
  ogTitle: `I just voted for ${songTitle?.toLowerCase()} by ${artist?.toLowerCase()} at Tim Benniks' talk at ${conference}`,
  ogImage: url,
  ogImageWidth: 1920,
  ogImageHeight: 1080,
  twitterTitle: `I just voted for ${songTitle?.toLowerCase()}!`,
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
      :alt="`I just voted for ${songTitle?.toLowerCase()} by ${artist?.toLowerCase()} at Tim Benniks' talk at ${conference}`"
      class="w-full block fancy-image mb-4"
    />

    <a
      :href="`https://twitter.com/intent/tweet?text=${encodeURIComponent(
        `I just voted for ${songTitle?.toLowerCase()} by ${artist?.toLowerCase()} @timbenniks talk at ${conference}`
      )}&url=${encodeURI(`https://aliveandkicking.dev${route.fullPath}`)}`"
      class="inline-block cta mb-12 justify-center fancy-bg"
      target="_blank"
    >
      <span class="mt-[3px] text-md md:text-xl">Share on Twitter</span>
    </a>

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
