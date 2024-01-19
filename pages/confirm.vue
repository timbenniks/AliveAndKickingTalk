<script setup lang="ts">
const user = useSupabaseUser();

watch(
  user,
  () => {
    if (user.value) {
      return navigateTo("/");
    }
  },
  { immediate: true }
);
</script>
<template>
  <loader class="absolute top-2/4 left-2/4 -translate-x-2/4 -translate-y-2/4" />
</template>
