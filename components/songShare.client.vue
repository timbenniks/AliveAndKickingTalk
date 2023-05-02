<script lang="ts" setup>
const user = useSupabaseUser();
const props = defineProps(["song"]);
const songStore = useSongStore();
const conference = songStore.conference;

const song = ref(props.song?.song);
const songId = ref(props.song?.songId);
const artist = ref(props.song?.artist);
</script>

<template>
  <a
    target="_blank"
    class="block underline font-black uppercase mt-3"
    :href="`https://twitter.com/intent/tweet?text=${encodeURIComponent(
      `I just voted for ${song} at by ${artist} @timbenniks talk at ${conference}`
    )}&url=${encodeURI(
      `https://www.aliveandkicking.dev/share/${songId}?userid=${user.id}`
    )}`"
    >TWEET MY VOTE</a
  >
</template>
