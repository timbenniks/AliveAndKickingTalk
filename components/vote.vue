<script setup lang="ts">
const { mashupMode } = useRuntimeConfig().public;
</script>

<template>
  <mashup-vote v-if="mashupMode === 'true'" />
  <regular-vote v-else="mashupMode === 'false'" />
</template>
