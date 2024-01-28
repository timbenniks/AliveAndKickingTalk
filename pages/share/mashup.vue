<script setup lang="ts">
import { constructCloudinaryUrl } from "@cloudinary-util/url-loader";
import { storeToRefs } from "pinia";

import type { Database } from "../../types";
import { useSongStore } from "~/store/songs";

const route = useRoute();
const { userid } = route.query;
const client = useSupabaseClient<Database>();

const songStore = useSongStore();
await songStore.getSongs();

const { allSongs } = storeToRefs(songStore);
const { conference } = useRuntimeConfig().public;

const { data: votes } = await client
  .from("votes")
  .select("*")
  .eq("userid", userid as string)
  .order("mashup_spot");

// const songs = [
//   {
//     art: "",
//     cover: "",
//     artist: "",
//     song: "",
//   },
// ];

const avatar = (votes && votes[0].user_avatar.replace("_normal", "")) || "";
const songs = votes?.map((vote) => {
  const song = allSongs.value.find((s) => s.songId === vote.songid);

  return {
    art: song?.artwork[0].publicId,
    cover: song?.coverPublicId,
    artist: song?.artist,
    song: song?.song,
  };
});

const cldOptions = {
  src: "Alive and Kicking/bg.jpg",
  width: 1920,
  height: 1080,
  crop: "fill",
  format: "jpg",

  overlays: [
    // Art
    {
      publicId: songs && songs[0].art,
      position: {
        gravity: "north_west",
        y: -50,
      },
      effects: [
        {
          opacity: 30,
          width: 960,
          height: 540,
        },
      ],
    },
    {
      publicId: songs && songs[1].art,
      position: {
        gravity: "north_east",
        y: -50,
      },
      effects: [
        {
          opacity: 30,
          width: 960,
          height: 540,
        },
      ],
    },

    {
      publicId: songs && songs[2].art,
      position: {
        gravity: "south_west",
        y: 50,
      },
      effects: [
        {
          opacity: 30,
          width: 960,
          height: 540,
        },
      ],
    },

    {
      publicId: songs && songs[3].art,
      position: {
        gravity: "south_east",
        y: 50,
      },
      effects: [
        {
          opacity: 30,
          width: 960,
          height: 540,
        },
      ],
    },

    // Covers
    {
      publicId: songs && songs[0].cover,
      position: {
        gravity: "north_west",
        x: 340,
        y: 80,
      },
      effects: [
        {
          border: "3px_solid_white",
          width: 300,
          height: 300,
        },
      ],
    },

    {
      publicId: songs && songs[1].cover,
      position: {
        gravity: "north_east",
        x: 340,
        y: 80,
      },
      effects: [
        {
          border: "3px_solid_white",
          width: 300,
          height: 300,
        },
      ],
    },
    {
      publicId: songs && songs[2].cover,
      position: {
        gravity: "south_west",
        x: 340,
        y: 180,
      },
      effects: [
        {
          border: "3px_solid_white",
          width: 300,
          height: 300,
        },
      ],
    },

    {
      publicId: songs && songs[3].cover,
      position: {
        gravity: "south_east",
        x: 340,
        y: 180,
      },
      effects: [
        {
          border: "3px_solid_white",
          width: 300,
          height: 300,
        },
      ],
    },

    // User
    {
      url: avatar,
      position: {
        gravity: "center",
        y: -50,
      },
      effects: [
        {
          width: 300,
          height: 300,
          radius: 600,
        },
      ],
    },

    // Marketing
    {
      publicId: "Alive and Kicking/vuejsams24-overlay-mashup-6",
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
  ],
  // overlays: [
  //   // Art
  //   {
  //     publicId: songs && songs[0].art,
  //     position: {
  //       gravity: "north_west",
  //       y: -50,
  //     },
  //     effects: [
  //       {
  //         opacity: 20,
  //         width: 960,
  //         height: 540,
  //       },
  //     ],
  //   },
  //   {
  //     publicId: songs && songs[1].art,
  //     position: {
  //       gravity: "north_east",
  //       y: -50,
  //     },
  //     effects: [
  //       {
  //         opacity: 20,
  //         width: 960,
  //         height: 540,
  //       },
  //     ],
  //   },

  //   {
  //     publicId: songs && songs[2].art,
  //     position: {
  //       gravity: "south_west",
  //       y: 50,
  //     },
  //     effects: [
  //       {
  //         opacity: 20,
  //         width: 960,
  //         height: 540,
  //       },
  //     ],
  //   },

  //   {
  //     publicId: songs && songs[3].art,
  //     position: {
  //       gravity: "south_east",
  //       y: 50,
  //     },
  //     effects: [
  //       {
  //         opacity: 20,
  //         width: 960,
  //         height: 540,
  //       },
  //     ],
  //   },

  //   // Covers
  //   {
  //     publicId: songs && songs[0].cover,
  //     position: {
  //       gravity: "north_west",
  //       x: 50,
  //       y: 50,
  //     },
  //     effects: [
  //       {
  //         border: "3px_solid_white",
  //         width: 300,
  //         height: 300,
  //       },
  //     ],
  //   },

  //   {
  //     publicId: songs && songs[1].cover,
  //     position: {
  //       gravity: "north_east",
  //       x: 50,
  //       y: 50,
  //     },
  //     effects: [
  //       {
  //         border: "3px_solid_white",
  //         width: 300,
  //         height: 300,
  //       },
  //     ],
  //   },
  //   {
  //     publicId: songs && songs[2].cover,
  //     position: {
  //       gravity: "south_west",
  //       x: 50,
  //       y: 240,
  //     },
  //     effects: [
  //       {
  //         border: "3px_solid_white",
  //         width: 300,
  //         height: 300,
  //       },
  //     ],
  //   },

  //   {
  //     publicId: songs && songs[3].cover,
  //     position: {
  //       gravity: "south_east",
  //       x: 50,
  //       y: 240,
  //     },
  //     effects: [
  //       {
  //         border: "3px_solid_white",
  //         width: 300,
  //         height: 300,
  //       },
  //     ],
  //   },

  //   // song info
  //   {
  //     width: 500,
  //     crop: "fit",
  //     text: {
  //       color: "white",
  //       fontFamily: "Lato",
  //       fontSize: 40,
  //       fontWeight: "black",
  //       text: songs && songs[0].artist,
  //     },
  //     position: {
  //       gravity: "north_west",
  //       x: 380,
  //       y: 50,
  //     },
  //   },
  //   {
  //     width: 500,
  //     crop: "fit",
  //     text: {
  //       color: "white",
  //       fontFamily: "Lato",
  //       fontSize: 30,
  //       fontWeight: "light",
  //       text: songs && songs[0].song,
  //     },
  //     position: {
  //       gravity: "north_west",
  //       x: 380,
  //       y: 90,
  //     },
  //   },

  //   {
  //     width: 500,
  //     crop: "fit",
  //     text: {
  //       color: "white",
  //       fontFamily: "Lato",
  //       fontSize: 40,
  //       fontWeight: "black",
  //       text: songs && songs[1].artist,
  //     },
  //     position: {
  //       gravity: "north_east",
  //       x: 380,
  //       y: 50,
  //     },
  //   },
  //   {
  //     width: 500,
  //     crop: "fit",
  //     text: {
  //       color: "white",
  //       fontFamily: "Lato",
  //       fontSize: 30,
  //       fontWeight: "light",
  //       text: songs && songs[1].song,
  //     },
  //     position: {
  //       gravity: "north_east",
  //       x: 380,
  //       y: 90,
  //     },
  //   },

  //   {
  //     width: 500,
  //     crop: "fit",
  //     text: {
  //       color: "white",
  //       fontFamily: "Lato",
  //       fontSize: 40,
  //       fontWeight: "black",
  //       text: songs && songs[2].artist,
  //     },
  //     position: {
  //       gravity: "south_west",
  //       x: 380,
  //       y: 516,
  //     },
  //   },
  //   {
  //     width: 500,
  //     crop: "fit",
  //     text: {
  //       color: "white",
  //       fontFamily: "Lato",
  //       fontSize: 30,
  //       fontWeight: "light",
  //       text: songs && songs[2].song,
  //     },
  //     position: {
  //       gravity: "south_west",
  //       x: 380,
  //       y: 480,
  //     },
  //   },

  //   {
  //     width: 500,
  //     crop: "fit",
  //     text: {
  //       color: "white",
  //       fontFamily: "Lato",
  //       fontSize: 40,
  //       fontWeight: "black",
  //       text: songs && songs[3].artist,
  //     },
  //     position: {
  //       gravity: "south_east",
  //       x: 380,
  //       y: 516,
  //     },
  //   },
  //   {
  //     width: 500,
  //     crop: "fit",
  //     text: {
  //       color: "white",
  //       fontFamily: "Lato",
  //       fontSize: 30,
  //       fontWeight: "light",
  //       text: songs && songs[3].song,
  //     },
  //     position: {
  //       gravity: "south_east",
  //       x: 380,
  //       y: 480,
  //     },
  //   },

  //   // User
  //   {
  //     url: avatar,
  //     position: {
  //       gravity: "center",
  //       y: -50,
  //     },
  //     effects: [
  //       {
  //         width: 300,
  //         height: 300,
  //         radius: 600,
  //       },
  //     ],
  //   },

  //   // Marketing
  //   {
  //     publicId: "Alive and Kicking/vuejsams24-overlay-mashup-6",
  //     position: {
  //       x: 0,
  //       y: 0,
  //     },
  //     effects: [
  //       {
  //         width: 1920,
  //         height: 1080,
  //       },
  //     ],
  //   },
  // ],
};

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
