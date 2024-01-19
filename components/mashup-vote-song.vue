<script setup lang="ts">
const props = defineProps(["song", "spot", "voting"]);

const emit = defineEmits<{
  (e: "openSongSelect", spot: number): void;
  (e: "removeVote", spot: number): void;
}>();

function openSongSelect() {
  emit("openSongSelect", props.spot);
}

function removeVote() {
  emit("removeVote", props.spot);
}
</script>

<template>
  <li class="h-[168px] md:h-auto">
    <div
      v-if="song"
      class="flex flex-col justify-between relative w-full h-full"
    >
      <div
        :style="`background: url(${song?.artwork[2].bg}); background-position: 50%`"
        class="h-full p-4"
      >
        <figure class="flex space-x-2 mb-4">
          <img
            :src="
              song?.cover.replace('q_auto,f_auto', 'q_auto,f_auto,w_380,h_380')
            "
            :alt="`${song?.artist} ${song?.song}`"
            width="100"
            height="100"
            class="w-20 h-20 md:w-56 md:h-56 fancy-image"
          />
          <figcaption class="block text-left">
            <span class="block uppercase font-black text-lg md:text-3xl">{{
              song?.song
            }}</span>
            <span class="block uppercase font-light text-lg md:text-3xl">{{
              song?.artist
            }}</span>
          </figcaption>
        </figure>
        <div class="grid gap-2 grid-cols-3 justify-center items-center">
          <button class="cta-fancy w-auto" @click="openSongSelect()">
            change
          </button>
          <button class="cta w-auto" @click="removeVote()" :disabled="voting">
            remove
          </button>
          <SongShare
            buttonclass="cta w-full"
            :copy="false"
            nativecopy="SHARE"
            :song="song"
          />
        </div>
      </div>
    </div>
    <div
      v-else
      class="fancy-image h-full box-border mb-4 flex flex-col justify-center items-center"
    >
      <p class="block uppercase font-black text-lg mb-2">
        MASHUP SPOT {{ spot }}
      </p>
      <button class="cta-fancy" @click="openSongSelect()">select</button>
    </div>
  </li>
</template>
