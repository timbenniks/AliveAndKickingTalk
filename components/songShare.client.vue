<script lang="ts" setup>
import { constructCloudinaryUrl } from "@cloudinary-util/url-loader";

const user = useSupabaseUser();
const props = defineProps(["song"]);

const art = ref(
  props.song.artwork[0].bg.split("o_30/")[1].replace(/%20/g, " ")
);

const ghUser = ref(`github/${user.value?.user_metadata.sub}`);
const artist = ref(props.song?.artist.replace("/", "%2F"));
const song = ref(props.song?.song);

const url = constructCloudinaryUrl({
  options: {
    src: art.value || "",
    width: 1920,
    height: 1080,
    crop: "fill",
    format: "jpg",
    rawTransformations: ["b_black,o_20"],

    overlays: [
      {
        publicId: `Alive and Kicking/overlays.png`,
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
        publicId: ghUser.value,
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
          text: artist.value,
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
          text: song.value,
        },
        position: {
          y: 190,
          gravity: "center",
        },
      },
    ],
  },

  config: {
    cloud: {
      cloudName: "dwfcofnrd",
    },
  },
});

async function share() {
  const blob = await fetch(url).then((r) => r.blob());

  const shareData = {
    title: "I just voted!",
    text: `I voted for ${song.value} by ${artist.value.replace(
      "%2F",
      "/"
    )} during Tim Benniks' talk: Alive and Kicking.`,
    url: "https://aliveandkicking.vercel.app",
    files: [
      new File([blob], "file.jpg", {
        type: blob.type,
      }),
    ],
  };

  try {
    if (!navigator.share(shareData)) {
      window.open(url, "_blank")?.focus();
    }
    await navigator.share(shareData);
  } catch (err) {
    console.error(err);
  }
}
</script>

<template>
  <button @click="share()" class="underline font-black uppercase block">
    SHARE MY VOTE
  </button>
</template>
