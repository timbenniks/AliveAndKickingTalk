<script lang="ts" setup>
import { createMashupImage, createShareImage } from "#shared/utils/images";
import type { Database, Song } from "~/types";
import { storeToRefs } from "pinia";

const user = useSupabaseUser();
const client = useSupabaseClient<Database>();
const props = defineProps<{ song?: Song; nativecopy: string; buttonclass?: string; mashup: boolean }>();
const songStore = useSongStore();
const { allSongs } = storeToRefs(songStore);
const { conference } = useRuntimeConfig().public;

const canShare = ref();
const url = ref();
const avatar = (
  user.value?.user_metadata?.picture || user.value?.user_metadata?.avatar_url || ''
).replace("_normal", "");

const imgUrl = ref("");

if (props.mashup) {
  const { data: votes } = await client
    .from("votes")
    .select("*")
    .eq("userid", user?.value?.sub as string)
    .order("mashup_spot");

  const songids = votes
    ?.map((vote) => {
      return vote.songid;
    })
    .join(",");

  imgUrl.value = await createMashupImage(
    avatar as string,
    allSongs.value,
    songids as string
  );
} else if (props.song) {
  imgUrl.value = await createShareImage(avatar as string, props.song);
}

async function share() {
  const shareSavedData = await songStore.saveShare(
    user.value?.sub as string,
    avatar as string,
    props.mashup,
    !props.mashup ? props.song?.songId : undefined
  );

  const title = `Alive and Kicking by Tim Benniks at ${conference}`;
  const text = props.mashup
    ? `I just voted for my favorite mashup at ${conference} @timbenniks`
    : `I just voted for ${props.song?.song} by ${props.song?.artist} at ${conference} @timbenniks`;
  const url = `https://aliveandkicking.dev/share/${shareSavedData?.id}`;
  await navigator.share({ title, text, url });
}

async function shareNoneNative(which: "twitter" | "linkedin") {
  let shareUrl = "";

  const shareSavedData = await songStore.saveShare(
    user.value?.sub as string,
    avatar as string,
    props.mashup,
    !props.mashup ? props.song?.songId : undefined
  );

  const text = props.mashup
    ? `I just voted for my favorite mashup at ${conference} @timbenniks`
    : `I just voted for ${props.song?.song} by ${props.song?.artist} at ${conference} @timbenniks`;
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
  <div class="share-vote">
    <div v-if="user && canShare">
      <PixelButton v-if="url" variant="secondary" :class="buttonclass" @click="share()">
        {{ nativecopy }}
      </PixelButton>
      <loader v-else />
    </div>
    <div v-if="user && !canShare">
      <div v-if="url" class="share-vote-row">
        <PixelButton
          variant="secondary"
          :class="buttonclass"
          :aria-label="mashup ? undefined : 'Share on Twitter'"
          @click="shareNoneNative('twitter')"
        >
          <twitter class="share-vote-icon" />
          <template v-if="mashup">{{ nativecopy }}</template>
        </PixelButton>
        <PixelButton
          variant="secondary"
          :class="buttonclass"
          :aria-label="mashup ? undefined : 'Share on LinkedIn'"
          @click="shareNoneNative('linkedin')"
        >
          <img src="/linkedin.png" alt="" class="share-vote-icon">
          <template v-if="mashup">{{ nativecopy }}</template>
        </PixelButton>
      </div>
      <loader v-else />
    </div>
  </div>
</template>

<style>
.share-vote { text-align: left; }
.share-vote-row { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.share-vote-icon { width: 1.1rem; height: 1.1rem; object-fit: contain; flex: none; }
</style>
