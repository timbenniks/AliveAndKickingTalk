<script lang="ts" setup>
const user = useSupabaseUser();
const props = defineProps(["song"]);
const songStore = useSongStore();
const conference = songStore.conference;

const song = ref(props.song?.song);
const songId = ref(props.song?.songId);
const artist = ref(props.song?.artist.replace("/", "%2F"));

async function share() {
  const shareData = {
    title: `I just voted for ${song} by ${artist.value} at @timbenniks talk at ${conference}`,
    url: `https://www.aliveandkicking.dev/share/${songId}?userid=${user.id}`,
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
    class="hidden md:block underline font-black uppercase mt-3"
    :href="`https://twitter.com/intent/tweet?text=${encodeURIComponent(
      `I just voted for ${song} at by ${artist} @timbenniks talk at ${conference}`
    )}&url=${encodeURI(
      `https://www.aliveandkicking.dev/share/${songId}?userid=${user.id}`
    )}`"
    >TWEET MY VOTE</a
  >
</template>
