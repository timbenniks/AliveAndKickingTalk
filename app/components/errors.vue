<script setup lang="ts">
import { storeToRefs } from "pinia";
const songStore = useSongStore();
const { errors } = storeToRefs(songStore);
</script>

<template>
  <p v-if="errors" role="alert" class="error-banner">
    {{ errors }}
  </p>
</template>

<style>
.error-banner {
  position: fixed;
  inset: 0 0 auto;
  z-index: 1000;
  padding: 0.625rem 1rem;
  background: var(--color-fret-2);
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-weight: 500;
  font-size: 1rem;
  text-align: center;
  box-shadow: 0 var(--px) 0 var(--color-ink);
}
</style>
