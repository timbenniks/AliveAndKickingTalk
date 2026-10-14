<script setup lang="ts">
// A tolex panel. Its .pixel-panel style lives in tailwind.css so plain elements can use it.
// `fret` tints the frame with a lane color when the panel stands for a song or lane.
const props = withDefaults(defineProps<{ fret?: number, tag?: string }>(), { fret: 0, tag: 'section' });
const edge = computed(() => props.fret ? `var(--color-fret-${props.fret})` : 'var(--color-tolex-hi)');
</script>

<template>
  <component :is="tag" class="pixel-panel px-frame" :style="{ '--edge': edge }">
    <slot />
  </component>
</template>
