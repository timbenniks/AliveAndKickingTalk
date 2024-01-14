<script lang="ts" setup>
import { storeToRefs } from "pinia";

const props = defineProps(["song"]);
const songStore = useSongStore();
const { allSongs } = storeToRefs(songStore);

setInterval(async () => {
  await songStore.getVotesForSongs();
}, 5000);

await songStore.getVotesForSongs();

const songs = computed(() => {
  return allSongs.value
    .filter((song) => song.songId !== props.song.songId)
    .sort((a, b) => b.votes - a.votes);
});
</script>

<template>
  <ul>
    <li v-for="song in songs" class="mb-4">
      <a :href="`/live/${song.songId}`" class="block no-underline">
        <figure class="flex">
          <img
            :src="song.cover"
            loading="lazy"
            :alt="`${song.artist} ${song.song}`"
            width="200"
            height="200"
            class="w-36 h-36 block mr-4 fancy-image"
          />
          <figcaption class="block text-left mb-4">
            <span class="block uppercase font-black text-xl break-all">{{
              song.song
            }}</span>
            <span class="block uppercase font-light text-xl">
              {{ song.artist }}
            </span>

            <p class="mt-9">
              <span class="text-5xl font-black flowing-title mr-2">{{
                song.votes
              }}</span>
              <span v-if="song.votes === 1"> VOTE </span>
              <span v-else>VOTES</span>
            </p>
          </figcaption>
        </figure>
      </a>
    </li>
  </ul>
</template>
