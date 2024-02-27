<script lang="ts" setup>
import { createMashupImage, createShareImage } from "../helpers";
import type { Database } from "~/types";
import { storeToRefs } from "pinia";

const user = useSupabaseUser();
const client = useSupabaseClient<Database>();
const props = defineProps(["song", "nativecopy", "buttonclass", "mashup"]);
const songStore = useSongStore();
const { allSongs } = storeToRefs(songStore);
const { conference } = useRuntimeConfig().public;

const canShare = ref();
const url = ref();
const avatar = (
  user.value?.user_metadata.picture || user.value?.user_metadata.avatar_url
).replace("_normal", "");

let imgUrl = ref("");

if (props.mashup) {
  const { data: votes } = await client
    .from("votes")
    .select("*")
    .eq("userid", user?.value?.id as string)
    .order("mashup_spot");

  const songids = votes
    ?.map((vote) => {
      return vote.songid;
    })
    .join(",");

  imgUrl.value = await createMashupImage(
    avatar as string,
    allSongs,
    songids as string
  );
} else {
  imgUrl.value = await createShareImage(avatar as string, props.song);
}

async function share() {
  const shareSavedData = await songStore.saveShare(
    user.value?.id as string,
    avatar as string,
    props.mashup,
    !props.mashup ? props.song.songId : null
  );

  const title = `Alive and Kicking by Tim Benniks at ${conference}`;
  const text = props.mashup
    ? `I just voted for my favorite mashup at ${conference} @timbenniks`
    : `I just voted for ${props.song.song} by ${props.song.artist} at ${conference} @timbenniks`;
  const url = `https://aliveandkicking.dev/share/${shareSavedData?.id}`;
  await navigator.share({ title, text, url });
}

async function shareNoneNative(which: "twitter" | "linkedin") {
  let shareUrl = "";

  const shareSavedData = await songStore.saveShare(
    user.value?.id as string,
    avatar as string,
    props.mashup,
    !props.mashup ? props.song.songId : null
  );

  const text = props.mashup
    ? `I just voted for my favorite mashup at ${conference} @timbenniks`
    : `I just voted for ${props.song.song} by ${props.song.artist} at ${conference} @timbenniks`;
  const url = `https://aliveandkicking.dev/share/${shareSavedData?.id}`;

  if (which === "linkedin") {
    shareUrl = `https://www.linkedin.com/feed/?shareActive=true?&text=${encodeURIComponent(
      `${text} ${url}`
    )}`;
  } else {
    shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      `${text} ${url}`
    )}`;
  }

  window.open(shareUrl);
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
    <div v-if="user && canShare" class="flex space-x-3">
      <template v-if="url">
        <button :class="buttonclass" @click="share()">
          {{ nativecopy }}
        </button>
      </template>
      <template v-else>
        <loader />
      </template>
    </div>
    <div v-if="user && !canShare">
      <template v-if="url">
        <div class="flex space-x-2 max-w-[500px]">
          <button
            :class="buttonclass"
            class="flex justify-center"
            @click="shareNoneNative('twitter')"
          >
            <twitter class="w-5 mr-2" />
            <template v-if="mashup">{{ nativecopy }}</template>
          </button>
          <button
            :class="buttonclass"
            class="flex justify-center"
            @click="shareNoneNative('linkedin')"
          >
            <img src="/linkedin.png" class="w-5 mr-2" />
            <template v-if="mashup">{{ nativecopy }}</template>
          </button>
        </div>
      </template>
      <template v-else>
        <loader />
      </template>
    </div>
  </div>
</template>
