<script lang="ts" setup>
import type { Ref } from "vue";

defineProps({
  vol: { type: Number, required: true },
});

const track: Ref<HTMLInputElement | null> = ref(null);
const emit = defineEmits(["setvol"]);

function onInput(e: Event) {
  emit("setvol", Number((e.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="absolute top-96 z-50 left-12">
    <p class="uppercase font-light text-xl mb-2">Track volume:</p>
    <input
      type="range"
      min="0"
      max="1"
      step="0.1"
      :value="vol"
      @input="onInput"
      ref="track"
    />
  </div>
</template>
