<script lang="ts" setup>
defineProps<{
  time: number;
  duration: number;
  from: number;
}>();
</script>

<template>
  <div
    class="absolute z-20 left-2/4 top-2/4 -translate-y-2/4 -translate-x-2/4 font-black flowing-title text-[300px]"
  >
    <template
      v-if="duration && duration - time !== 0 && duration - time <= from"
    >
      {{ (duration - time).toFixed(0) }}
    </template>
  </div>
</template>
