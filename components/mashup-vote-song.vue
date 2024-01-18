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
  <li class="p-6 pb-0 h-[168px]">
    <div v-if="song">
      <div
        :style="`background: url(${song?.artwork[2].bg}); background-position: 50%`"
        class="p-2 mb-2"
      >
        <figure class="flex space-x-2">
          <img
            :src="
              song?.cover.replace('q_auto,f_auto', 'q_auto,f_auto,w_380,h_380')
            "
            :alt="`${song?.artist} ${song?.song}`"
            width="100"
            height="100"
            class="w-20 h-20 fancy-image"
          />
          <figcaption class="block text-left">
            <span class="block uppercase font-black text-lg">{{
              song?.song
            }}</span>
            <span class="block uppercase font-light text-lg">{{
              song?.artist
            }}</span>
          </figcaption>
        </figure>
      </div>

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
