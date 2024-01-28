<script lang="ts" setup>
const user = useSupabaseUser();
const props = defineProps([
  "song",
  "copy",
  "nativecopy",
  "buttonclass",
  "mashup",
]);
const { conference } = useRuntimeConfig().public;

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
    <div v-if="user" class="flex space-x-3">
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
    </div>
  </div>
</template>
