<script lang="ts" setup>
const user = useSupabaseUser();
const props = defineProps(["song", "canshare"]);
const { conference } = useRuntimeConfig().public;
const { song, songId, artist } = props.song;

async function share(title: string, text: string, url: string) {
  await navigator.share({ title, text, url });
}
</script>

<template>
  <div class="share-vote text-left">
    <div v-if="canshare && user" class="flex space-x-3">
      <span class="text-sm">SHARE ON</span>
      <button
        @click="
          share(
            'Share baby',
            `I just voted for ${song} at by ${artist} at ${conference}`,
            `https://www.aliveandkicking.dev/share/${songId}?userid=${user.id}`
          )
        "
      >
        share
      </button>
      <a
        target="_blank"
        :href="`https://twitter.com/intent/tweet?text=${encodeURIComponent(
          `I just voted for ${song} at by ${artist} at ${conference}`
        )}&url=${encodeURI(
          `https://www.aliveandkicking.dev/share/${songId}?userid=${user.id}`
        )}`"
      >
        <twitter class="w-5" />
      </a>
      <a
        target="_blank"
        :href="`https://www.linkedin.com/feed/?shareActive=true?&text=${encodeURIComponent(
          `I just voted for ${song} by ${artist} at ${conference} https://www.aliveandkicking.dev/share/${songId}?userid=${user.id}`
        )}`"
      >
        <img src="/linkedin.png" class="w-5 relative -top-0.5" />
      </a>
    </div>
  </div>
</template>
