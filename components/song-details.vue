<script setup lang="ts">
defineProps(["song"]);
</script>

<template>
  <figure class="flex p-12 pb-0 mb-4">
    <img
      :src="song.cover"
      loading="lazy"
      :alt="`${song.artist} ${song.song}`"
      width="200"
      height="200"
      class="fancy-image w-56 block h-56 mr-4"
    />
    <figcaption class="block text-left mb-4">
      <span class="block uppercase font-black text-6xl break-all">{{
        song.song
      }}</span>
      <span class="block uppercase font-light text-4xl">{{ song.artist }}</span>
    </figcaption>
  </figure>
  <midi :song="song" />
</template>
