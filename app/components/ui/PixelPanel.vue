<script setup lang="ts">
// A tolex panel. `fret` tints the frame with a lane color when the panel stands for a song or lane.
const props = withDefaults(defineProps<{ fret?: number, tag?: string }>(), { fret: 0, tag: 'section' });
const edge = computed(() => props.fret ? `var(--color-fret-${props.fret})` : 'var(--color-tolex-hi)');
</script>

<template>
  <component :is="tag" class="pixel-panel px-frame" :style="{ '--edge': edge }">
    <slot />
  </component>
</template>

<style>
.pixel-panel {
  background: var(--color-tolex);
  color: var(--color-bone);
  padding: 1rem;
}
</style>
