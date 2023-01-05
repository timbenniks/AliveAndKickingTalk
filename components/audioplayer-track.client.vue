<script lang="ts" setup>
import type { Ref } from "vue";

defineProps({
  percentage: { type: Number, required: true },
});

const track: Ref<HTMLInputElement | null> = ref(null);
const emit = defineEmits(["seek"]);

function onInput(e: Event) {
  emit("seek", (e.target as HTMLInputElement).value);
}

const trackWidth = ref(0);

onMounted(async () => {
  await nextTick();

  trackWidth.value = (
    track.value?.parentNode as HTMLElement
  ).getBoundingClientRect().width;

  track.value?.style.setProperty("--sliderSize", `${trackWidth.value}px`);
});
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
      ref="track"
    />
  </div>
</template>

<style scoped>
.audio-track input[type="range"] {
  --sliderSize: 245px;
  position: relative;
  top: -1px;
  overflow: hidden;
  width: var(--sliderSize);
  -webkit-appearance: none;
  background: linear-gradient(89.87deg, #256ad1 7.57%, #d1258c 95.58%);
  border-radius: 5px;
}

.audio-track input[type="range"]:focus {
  outline: none;
}

.audio-track input[type="range"]::-webkit-slider-runnable-track {
  height: 8px;
  -webkit-appearance: none;
  color: #fff;
  margin-top: -1px;
}

.audio-track input[type="range"]::-webkit-slider-thumb {
  width: 8px;
  -webkit-appearance: none;
  height: 8px;
  cursor: ew-resize;
  background: #fff;
  box-shadow: var(--sliderSize) 0 0 var(--sliderSize) #fff;
}
</style>
