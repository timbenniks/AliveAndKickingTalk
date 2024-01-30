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
    : `I just voted for ${props.song.song} at by ${props.song.artist} at ${conference} @timbenniks`;
  const url = `https://aliveandkicking.dev/share/${shareSavedData?.id}`;
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
  </div>
</template>
