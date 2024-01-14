<script setup lang="ts">
defineProps(["song"]);
</script>

<template>
  <figure class="flex p-12 pb-0 mb-4">
    <img
      :src="song.cover.replace('q_auto,f_auto', 'q_auto,f_auto,w_380,h_380')"
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
      <span class="block uppercase font-light text-5xl mb-4">{{
        song.artist
      }}</span>
      <img
        src="/vueamsterdam.png"
        alt="Vue Amsterdam"
        class="w-48 relative -left-1"
      />
    </figcaption>
  </figure>
</template>
