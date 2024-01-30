<script lang="ts" setup>
defineProps(["currentSong", "songs"]);
</script>

<template>
  <div class="p-4">
    <h2 class="font-black text-4xl uppercase mb-8">Up Next</h2>

    <ul>
      <li v-for="song in songs" class="mb-4">
        <a :href="`/live/${song.songId}`" class="block no-underline">
          <figure class="flex">
            <img
              :src="
                song.cover.replace('q_auto,f_auto', 'q_auto,f_auto,w_140,h_140')
              "
              :alt="`${song.artist} ${song.song}`"
              width="200"
              height="200"
              class="w-20 h-20 block mr-4 fancy-image"
            />
            <figcaption class="block text-left mb-4">
              <span class="block uppercase font-black text-xl break-all">{{
                song.song
              }}</span>
              <span class="block uppercase font-light text-xl">
                {{ song.artist }}
              </span>

              <p class="flowing-title">
                <span class="text-xl font-black mr-2">{{ song.votes }}</span>
                <span v-if="song.votes === 1"> VOTE </span>
                <span v-else>VOTES</span>
              </p>
            </figcaption>
          </figure>
        </a>
      </li>
    </ul>
  </div>
</template>
