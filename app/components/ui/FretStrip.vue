<script setup lang="ts">
// The six fret colors in a row. With `levels` (0..1 per lane) it becomes a meter.
const props = withDefaults(defineProps<{ levels?: number[], height?: number }>(), { levels: () => [], height: 8 });
const lanes = computed(() => [0, 1, 2, 3, 4, 5].map(i => props.levels.length ? Math.max(0, Math.min(1, props.levels[i] ?? 0)) : 1));
</script>

<template>
  <div class="fret-strip" :style="{ height: `${height}px` }" aria-hidden="true">
    <span
      v-for="(level, i) in lanes"
      :key="i"
      :style="{ background: `var(--color-fret-${i + 1})`, opacity: 0.25 + level * 0.75, transform: `scaleY(${levels.length ? Math.max(0.2, level) : 1})` }"
    />
  </div>
</template>

<style>
.fret-strip { display: grid; grid-template-columns: repeat(6, 1fr); gap: var(--px); align-items: end; }
.fret-strip span { height: 100%; transform-origin: bottom; }
</style>
