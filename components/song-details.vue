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
      class="fancy-image w-80 block h-80 mr-4"
    />
    <figcaption class="block text-left mb-4">
      <span class="block uppercase font-black text-5xl break-all"
        >{{ song.song }}
        <span class="uppercase font-light text-3xl"
          >({{ song.length }})</span
        ></span
      >
      <span class="block uppercase font-light text-5xl">{{ song.artist }}</span>
    </figcaption>
  </figure>
</template>
