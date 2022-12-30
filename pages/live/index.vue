<script setup lang="ts">
import { storeToRefs } from "pinia";

const songStore = useSongStore();
const { allSongsAndVotes } = storeToRefs(songStore);

setInterval(async () => {
  await songStore.getVotesForSongs();
}, 5000);

await songStore.getVotesForSongs();

const songs = computed(() => {
  return allSongsAndVotes.value.sort((a, b) => b.votes - a.votes);
});
</script>

<template>
  <ul class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 p-4">
    <li v-for="song in songs" class="fancy-image p-4">
      <nuxt-link :to="`live/${song.songId}`" class="block no-underline">
        <figure class="xl:flex">
          <img
            :src="song.cover"
            loading="lazy"
            :alt="`${song.artist} ${song.song}`"
            width="200"
            height="200"
            class="xl:w-52 block xl:h-52 xl:mr-4"
          />
          <figcaption class="block text-left mb-4">
            <span class="block uppercase font-black text-2xl break-all">{{
              song.song
            }}</span>
            <span class="block uppercase font-light text-2xl md:mb-12">{{
              song.artist
            }}</span>

            <p>
              <span class="text-7xl font-black flowing-title mr-2">{{
                song.votes
              }}</span>
              <span v-if="song.votes === 1"> VOTE </span>
              <span v-else>VOTES</span>
            </p>
          </figcaption>
        </figure>
      </nuxt-link>
    </li>
  </ul>
</template>
