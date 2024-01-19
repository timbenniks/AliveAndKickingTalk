<script setup lang="ts">
import { storeToRefs } from "pinia";

const songStore = useSongStore();
await songStore.getConfigValues();
const { configValues } = storeToRefs(songStore);

const mashupMode = computed(() => {
  const mashupModeConfKey = configValues.value.find(
    (config) => config.key === "mashup_mode"
  );
  if (mashupModeConfKey) {
    return mashupModeConfKey.val === "true";
  }
});
</script>

<template>
  <mashup-vote v-if="mashupMode" />
  <regular-vote v-else="mashupMode" />
</template>
