<script setup lang="ts">
import { storeToRefs } from "pinia";
const songStore = useSongStore();
const { errors } = storeToRefs(songStore);
</script>

<template>
  <p
    v-if="errors"
    class="bg-[#ff0000] text-white p-2 text-center absolute z-[1000] w-full top-0 left-0 opacity-95"
  >
    {{ errors }}
  </p>
</template>
