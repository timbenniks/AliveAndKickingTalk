<script lang="ts" setup>
import { createMashupImage, createShareImage } from "../helpers";
import { storeToRefs } from "pinia";

const user = useSupabaseUser();
const props = defineProps([
  "song",
  "copy",
  "nativecopy",
  "buttonclass",
  "mashup",
]);

const songStore = useSongStore();
const { allSongs } = storeToRefs(songStore);
const { conference } = useRuntimeConfig().public;
const canShare = ref();
const url = ref();

let imgUrl = ref("");

if (props.mashup) {
  imgUrl.value = await createMashupImage(user?.value?.id as string, allSongs);
} else {
  imgUrl.value = await createShareImage(
    user?.value?.id as string,
    props.song.songId as string,
    props.song
  );
}

async function share(title: string, text: string, url: string) {
  await navigator.share({ title, text, url });
}

onMounted(() => {
  canShare.value = typeof navigator.share === "function";

  const image = new Image();
  image.src = imgUrl.value;
  image.onload = () => {
    url.value = imgUrl.value;
  };
});
</script>

<template>
  <div class="share-vote text-left">
    <div v-if="user" class="flex space-x-3">
      <template v-if="url">
        <button
          :class="buttonclass"
          v-if="canShare"
          @click="
            share(
              `Alive and Kicking by Tim Benniks at ${conference}`,
              props.mashup
                ? `I just voted for my favorite mashup at ${conference}`
                : `I just voted for ${props.song.song} at by ${props.song.artist} at ${conference}`,
              props.mashup
                ? `https://aliveandkicking.dev/share/mashup?userid=${user.id}`
                : `https://aliveandkicking.dev/share/${props.song.songId}?userid=${user.id}`
            )
          "
        >
          {{ nativecopy }}
        </button>

        <template v-else>
          <span class="text-sm" v-if="copy">{{ copy }}</span>
          <a
            target="_blank"
            :href="`https://twitter.com/intent/tweet?text=${encodeURIComponent(
              props.mashup
                ? `I just voted for my favorite mashup at ${conference}`
                : `I just voted for ${props.song.song} at by ${props.song.artist} at ${conference}`
            )}&url=${encodeURI(
              `${
                props.mashup
                  ? `https://aliveandkicking.dev/share/mashup?userid=${user.id}`
                  : `https://aliveandkicking.dev/share/${props.song.songId}?userid=${user.id}`
              }`
            )}`"
          >
            <twitter class="w-5" />
          </a>
          <a
            target="_blank"
            :href="`https://www.linkedin.com/feed/?shareActive=true?&text=${encodeURIComponent(
              `${
                props.mashup
                  ? `I just voted for my favorite mashup at ${conference}`
                  : `I just voted for ${props.song.song} at by ${props.song.artist} at ${conference}`
              } ${
                props.mashup
                  ? `https://aliveandkicking.dev/share/mashup?userid=${user.id}`
                  : `https://aliveandkicking.dev/share/${props.song.songId}?userid=${user.id}`
              }`
            )}`"
          >
            <img src="/linkedin.png" class="w-5 relative -top-0.5" />
          </a>
        </template>
      </template>
      <template v-else>
        <loader />
      </template>
    </div>
  </div>
</template>
