<script setup lang="ts">
const user = useSupabaseUser();
</script>

<template>
  <login v-if="!user" />
  <vote v-if="user" />
</template>
