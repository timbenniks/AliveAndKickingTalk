<script setup lang="ts">
import type { PlayedSong, Song } from "~/types";

const props = defineProps([
  "song",
  "spot",
  "voting",
  "playedSongs",
  "allSongs",
]);

const emit = defineEmits<{
  (e: "openSongSelect", spot: number): void;
  (e: "removeVote", spot: number): void;
}>();

const blocked = computed(() => {
  return props.playedSongs.find(
    (playedSong: PlayedSong) => playedSong.mashupSpot === props.spot
  );
});

const blockedSong = computed(() => {
  return props.allSongs.find(
    (song: Song) => song.songId === blocked.value.songId
  );
});

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
      v-if="blocked"
      class="flex flex-col justify-between relative w-full h-full"
    >
      <div class="h-full p-4 fancy-bg">
        <div class="uppercase text-2xl font-black mb-4">
          VOTING LOCKED for spot {{ spot }}
        </div>
        <figure class="flex space-x-2 mb-4">
          <img
            :src="
              blockedSong?.cover.replace(
                'q_auto,f_auto',
                'q_auto,f_auto,w_380,h_380'
              )
            "
            :alt="`${blockedSong?.artist} ${blockedSong?.song}`"
            width="100"
            height="100"
            class="w-20 h-20 md:w-56 md:h-56 fancy-image"
          />
          <figcaption class="block text-left">
            <span
              class="block uppercase font-black text-lg md:text-3xl leading-none"
              >{{ blockedSong?.song }}</span
            >
            <span class="block uppercase font-light text-lg md:text-3xl mb-2">{{
              blockedSong?.artist
            }}</span>
            <SongShare
              buttonclass="cta w-full"
              :copy="false"
              nativecopy="SHARE"
              :song="blockedSong"
            />
          </figcaption>
        </figure>
      </div>
    </div>

    <div
      v-else-if="song"
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
