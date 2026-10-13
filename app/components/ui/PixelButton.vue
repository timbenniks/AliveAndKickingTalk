<script setup lang="ts">
// A stompbox: notched pixel frame, voxel extrude, and it presses down like a footswitch.
const props = withDefaults(defineProps<{
  to?: string
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'md' | 'lg'
  disabled?: boolean
  type?: 'button' | 'submit'
}>(), { to: undefined, variant: 'primary', size: 'md', disabled: false, type: 'button' });

const tag = computed(() => props.to && !props.disabled ? resolveComponent('NuxtLink') : 'button');
</script>

<template>
  <component
    :is="tag"
    :to="tag === 'button' ? undefined : to"
    :type="tag === 'button' ? type : undefined"
    :disabled="tag === 'button' ? disabled : undefined"
    class="stompbox px-frame"
    :class="[`stompbox-${variant}`, `stompbox-${size}`]"
  >
    <slot />
  </component>
</template>

<style>
.stompbox {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5em;
  font-family: var(--font-pixel);
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-decoration: none;
  cursor: pointer;
  user-select: none;
  transition: transform 60ms steps(1), box-shadow 60ms steps(1);
}
.stompbox-md { padding: 0.375rem 1rem; font-size: 1.375rem; line-height: 1; }
.stompbox-lg { padding: 0.5rem 1.5rem; font-size: 2rem; line-height: 1; }
.stompbox-primary { background: var(--color-gold); color: var(--color-ink); --edge: var(--color-ink); }
.stompbox-secondary { background: var(--color-tolex); color: var(--color-bone); --edge: var(--color-bone); }
.stompbox-danger { background: var(--color-tolex); color: var(--color-fret-2); --edge: var(--color-fret-2); }
.stompbox:hover:not(:disabled) { filter: brightness(1.12); }
.stompbox:active:not(:disabled) { --depth: 0px; transform: translate(var(--px), var(--px)); }
.stompbox:focus-visible { outline: var(--px) solid var(--color-fret-4); outline-offset: calc(var(--px) * 2); }
.stompbox:disabled {
  --depth: 0px;
  cursor: not-allowed;
  background: var(--color-tolex);
  color: var(--color-dust);
  --edge: var(--color-tolex-hi);
}
@media (prefers-reduced-motion: reduce) {
  .stompbox { transition: none; }
}
</style>
