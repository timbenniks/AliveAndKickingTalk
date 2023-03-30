<script lang="ts" setup>
import { constructCloudinaryUrl } from "@cloudinary-util/url-loader";

const user = useSupabaseUser();
const props = defineProps(["song"]);

const art = ref(
  props.song.artwork[0].bg.split("o_30/")[1].replace(/%20/g, " ")
);

const publicId = ref("");

if (user.value?.user_metadata.avatar_url.includes("/u/")) {
  publicId.value = `github/${user.value?.user_metadata.avatar_url
    .split("/u/")[1]
    .replace("?v=4", "")
    .replace(".png", "")
    .replace(".jpg", "")}`;
} else {
  publicId.value = `twitter/${user.value?.user_metadata.avatar_url
    .split("/profile_images/")[1]
    .replace("_normal", "")
    .replace(".png", "")
    .replace(".jpg", "")}`;
}

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
      {
        publicId: publicId.value,
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

  if (navigator.share) {
    await navigator.share(shareData);
  }
}
</script>

<template>
  <button
    @click="share()"
    class="md:hidden underline font-black uppercase block"
  >
    SHARE MY VOTE
  </button>
  <a
    target="_blank"
    class="hidden md:block underline font-black uppercase"
    :href="`https://twitter.com/intent/tweet?text=${encodeURIComponent(
      `I voted for ${song} by ${artist} during @timbenniks talk: Alive and Kicking.`
    )}&url=${encodeURI(url)}`"
    >TWEET MY VOTE</a
  >
</template>
