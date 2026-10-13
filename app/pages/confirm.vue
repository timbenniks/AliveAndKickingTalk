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
  <main class="confirm-page">
    <loader />
    <p>Signing you in…</p>
  </main>
</template>

<style>
.confirm-page {
  min-height: 100dvh;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 1rem;
  background: var(--color-night);
  color: var(--color-dust);
  font-family: var(--font-caps);
  font-size: 0.75rem;
  text-transform: uppercase;
}
.confirm-page .pixel-loader { transform: scale(2); }
</style>
