<script setup lang="ts">
const user = useSupabaseUser();
</script>

<template>
  <errors />
  <login v-if="!user" />
  <vote v-if="user" />
</template>
