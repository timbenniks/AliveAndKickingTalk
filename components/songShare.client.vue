<script lang="ts" setup>
const user = useSupabaseUser();
const props = defineProps(["song", "canshare"]);
const { conference } = useRuntimeConfig().public;
const { song, songId, artist } = props.song;

async function share(title: string, text: string, url: string) {
  await navigator.share({ title, text, url });
}

const canShare = ref();

onMounted(() => {
  canShare.value = typeof navigator.share === "function";
});
</script>

<template>
  <div class="share-vote text-left">
    <div v-if="canshare && user" class="flex space-x-3">
      <button
        v-if="canShare"
        @click="
          share(
            `Alive and Kicking by Tim Benniks at ${conference}`,
            `I just voted for ${song} at by ${artist} at ${conference}`,
            `https://www.aliveandkicking.dev/share/${songId}?userid=${user.id}`
          )
        "
      >
        SHARE YOUR VOTE
      </button>

      <template v-else>
        <span class="text-sm">SHARE ON</span>
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
      </template>
    </div>
  </div>
</template>
