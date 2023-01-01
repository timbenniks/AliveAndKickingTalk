<script lang="ts" setup>
defineProps({
  percentage: { type: Number, required: true },
});

const emit = defineEmits(["seek"]);

function onInput(e: Event) {
  emit("seek", (e.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="audio-track">
    <input
      type="range"
      min="0"
      max="100"
      step="1"
      :value="percentage.toFixed(1)"
      @input="onInput"
    />
  </div>
</template>

<style>
input[type="range"] {
  position: relative;
  top: -1px;
  overflow: hidden;
  width: 245px;
  -webkit-appearance: none;
  background-color: #ccc;
  border-radius: 5px;
}

input[type="range"]:focus {
  outline: none;
}

input[type="range"]::-webkit-slider-runnable-track {
  height: 8px;
  -webkit-appearance: none;
  color: #333;
  margin-top: -1px;
}

input[type="range"]::-webkit-slider-thumb {
  width: 8px;
  -webkit-appearance: none;
  height: 8px;
  cursor: ew-resize;
  background: #333;
  box-shadow: -245px 0 0 245px #333;
}
</style>
