<script lang="ts" setup>
import { createMashupImage, createPicksImage, createShareImage } from "#shared/utils/images";
import type { Database, Song } from "~/types";
import { storeToRefs } from "pinia";

const user = useSupabaseUser();
const client = useSupabaseClient<Database>();
// `picks`: share every song this voter picked as one link (regular voting).
const props = defineProps<{ song?: Song; picks?: Song[]; nativecopy: string; buttonclass?: string; mashup: boolean; primary?: boolean }>();
const songStore = useSongStore();
const { allSongs } = storeToRefs(songStore);
const { conference } = useRuntimeConfig().public;

const canShare = ref();
const url = ref();
// Prefer our stored copy of the avatar: provider URLs expire.
const avatar = songStore.stableAvatar || (
  user.value?.user_metadata?.picture || user.value?.user_metadata?.avatar_url || ''
).replace("_normal", "");

const imgUrl = ref("");

if (props.mashup) {
  const { data: votes } = await client
    .from("votes")
    .select("songid")
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
} else if (props.picks?.length) {
  imgUrl.value = await createPicksImage(avatar as string, allSongs.value, props.picks.map(song => song.songId));
} else if (props.song) {
  imgUrl.value = await createShareImage(avatar as string, props.song);
}

function shareText() {
  if (props.mashup) return `I just voted for my favorite mashup at ${conference} @timbenniks`;
  if (props.picks?.length) return `My picks for tonight's show at ${conference}: ${props.picks.map(song => song.song).join(', ')} @timbenniks`;
  return `I just voted for ${props.song?.song} by ${props.song?.artist} at ${conference} @timbenniks`;
}

// Saves the share and returns its link, or null. The store sets the error
// banner on failure, so a link without an id is never built.
async function shareLink() {
  const id = await songStore.saveShare(
    user.value?.sub as string,
    avatar as string,
    props.mashup,
    props.mashup ? undefined : props.picks?.length ? props.picks.map(song => song.songId).join(",") : props.song?.songId
  );
  return id ? `https://aliveandkicking.dev/share/${id}` : null;
}

async function share() {
  const url = await shareLink();
  if (!url) return;
  try {
    await navigator.share({ title: `Alive and Kicking by Tim Benniks at ${conference}`, text: shareText(), url });
  } catch {
    // Closing the share sheet is not an error.
  }
}

async function shareNoneNative(which: "twitter" | "linkedin") {
  // Open the tab inside the tap, before any await, or phones block the popup.
  const tab = window.open("", "_blank");
  const url = await shareLink();
  if (!url) {
    tab?.close();
    return;
  }

  const message = encodeURIComponent(`${shareText()} ${url}`);
  const shareUrl = which === "linkedin"
    ? `https://www.linkedin.com/feed/?shareActive=true&text=${message}`
    : `https://twitter.com/intent/tweet?text=${message}`;

  if (tab) tab.location.href = shareUrl;
  else window.open(shareUrl);
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
      <PixelButton v-if="url" :variant="primary ? 'primary' : 'secondary'" :class="buttonclass" @click="share()">
        {{ nativecopy }}
      </PixelButton>
      <loader v-else />
    </div>
    <div v-if="user && !canShare">
      <div v-if="url" class="share-vote-row">
        <PixelButton
          :variant="primary ? 'primary' : 'secondary'"
          :class="buttonclass"
          :aria-label="mashup ? undefined : 'Share on X'"
          @click="shareNoneNative('twitter')"
        >
          <twitter class="share-vote-icon" />
          <template v-if="mashup">{{ nativecopy }}</template>
        </PixelButton>
        <PixelButton
          :variant="primary ? 'primary' : 'secondary'"
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
