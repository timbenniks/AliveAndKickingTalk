<script lang="ts" setup>
import { storeToRefs } from "pinia";

const props = defineProps(["song"]);
const songStore = useSongStore();
const { allSongsAndVotes, maxVotes } = storeToRefs(songStore);

setInterval(async () => {
  await songStore.getVotesForSongs();
}, 5000);

await songStore.getVotesForSongs();

const songs = computed(() => {
  return (
    allSongsAndVotes.value
      .filter((song) => song.songId !== props.song.songId)
      //.slice(0, maxVotes.value)
      .sort((a, b) => b.votes - a.votes)
  );
});
</script>

<template>
  <ul>
    <li v-for="song in songs" class="mb-4">
      <nuxt-link :to="`/live/${song.songId}`" class="block no-underline">
        <figure class="flex">
          <img
            :src="song.cover"
            loading="lazy"
            :alt="`${song.artist} ${song.song}`"
            width="200"
            height="200"
            class="w-24 h-24 block mr-4 fancy-image"
          />
          <figcaption class="block text-left mb-4">
            <span class="block uppercase font-black text-lg break-all">{{
              song.song
            }}</span>
            <span class="block uppercase font-light text-lg">
              {{ song.artist }}
            </span>

            <p>
              <span class="text-2xl font-black flowing-title mr-2">{{
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
