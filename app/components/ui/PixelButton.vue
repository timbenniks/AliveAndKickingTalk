<script setup lang="ts">
// A stompbox: notched pixel frame, voxel extrude, and it presses down like a footswitch.
// Styles live in tailwind.css (.stompbox) so plain links can wear them too.
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
