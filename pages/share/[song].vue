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
  <main>
    <img :src="url" width="400" />
  </main>
</template>
