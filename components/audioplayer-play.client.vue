<script lang="ts" setup>
const emit = defineEmits(["bigplay"]);

defineProps({
  playing: { type: Boolean, required: true },
});

function togglePlay() {
  emit("bigplay");
}
</script>

<template>
  <button
    v-show="!playing"
    @click="togglePlay"
    class="absolute z-30 left-2/4 top-2/4 -translate-y-2/4 -translate-x-2/4 bigplay flex fancy-bg rounded-full w-28 h-28 justify-center items-center cursor-pointer"
  >
    <span></span>
  </button>
</template>

<style lang="postcss">
.bigplay span {
  box-sizing: border-box;
  width: 40px;
  height: 40px;
  border-style: solid;
  display: block;
  border-width: 20px 0 20px 40px;
  border-color: transparent transparent transparent #fff;
}
</style>
