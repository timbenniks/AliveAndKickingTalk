<script setup lang="ts">
const user = useSupabaseUser();
</script>

<template>
  <vote v-if="user" />
</template>
