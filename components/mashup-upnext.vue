<script lang="ts" setup>
defineProps(["currentSong", "songs"]);
</script>

<template>
  <ul class="grid grid-rows-4 h-screen">
    <li
      v-for="(song, index) in songs"
      class="p-4"
      :class="{ 'fancy-bg': song.songId === currentSong.songId }"
    >
      <a
        :href="`/live/mashup/${song.songId}?spot=${index + 1}&autoplay=true`"
        class="no-underline flex relative w-full h-full"
      >
        <figure class="flex w-full">
          <img
            :src="
              song.cover.replace('q_auto,f_auto', 'q_auto,f_auto,w_140,h_140')
            "
            :alt="`${song.artist} ${song.song}`"
            width="200"
            height="200"
            class="w-auto h-full block mr-4 fancy-image"
          />
          <figcaption class="block text-left mb-4 relative w-full h-full">
            <span class="block uppercase font-black text-3xl">{{
              song.song
            }}</span>
            <span class="block uppercase font-light text-3xl">
              {{ song.artist }}
            </span>

            <span
              :class="
                song.songId === currentSong.songId
                  ? 'text-white'
                  : 'flowing-title'
              "
              class="text-7xl font-black mr-2 absolute right-4 bottom-4"
              >{{ song.votes }}</span
            >
          </figcaption>
        </figure>
      </a>
    </li>
  </ul>
</template>
