<script setup lang="ts">
// Small pixel caps. `fret` colors it by lane; otherwise it is gold.
const props = withDefaults(defineProps<{ fret?: number }>(), { fret: 0 });
const color = computed(() => props.fret ? `var(--color-fret-${props.fret})` : 'var(--color-gold)');
</script>

<template>
  <span class="pixel-badge" :style="{ '--badge': color }"><slot /></span>
</template>

<style>
.pixel-badge {
  display: inline-block;
  padding: 2px 6px 3px;
  font-family: var(--font-caps);
  font-size: 0.75rem;
  line-height: 1;
  text-transform: uppercase;
  color: var(--color-ink);
  background: var(--badge);
  box-shadow: var(--px) var(--px) 0 0 var(--color-ink);
}
</style>
