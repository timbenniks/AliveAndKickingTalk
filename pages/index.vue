<script setup lang="ts">
const user = useSupabaseUser();
console.log(user.value);
</script>

<template>
  <login v-if="!user" />
  <vote v-if="user" />
</template>
