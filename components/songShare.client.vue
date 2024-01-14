<script lang="ts" setup>
const user = useSupabaseUser();
const props = defineProps(["song", "canshare"]);
const songStore = useSongStore();
const conference = songStore.conference;

const song = ref(props.song?.song);
const songId = ref(props.song?.songId);
const artist = ref(props.song?.artist);
</script>

<template>
  <div class="share-vote text-left">
    <a
      v-if="canshare"
      target="_blank"
      class="block underline mt-3"
      :href="`https://twitter.com/intent/tweet?text=${encodeURIComponent(
        `I just voted for ${song} at by ${artist} @timbenniks talk at ${conference}`
      )}&url=${encodeURI(
        `https://www.aliveandkicking.dev/share/${songId}?userid=${user.id}`
      )}`"
    >
      Share this vote on Twitter</a
    >
    <span v-else> Vote first, share after </span>
  </div>
</template>
