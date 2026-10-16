<script setup lang="ts">
// Canvas note labels have an equivalent text readout for assistive technology.
const stage = useStageAudio();
const noteText = computed(() => stage.laneSource.value === 'midi' ? stage.midiNotes.value : stage.guitarNotes.value);
</script>

<template>
  <p v-if="stage.laneSource.value === 'midi' || (stage.laneSource.value === 'guitar' && stage.guitarMode.value === 'polyphonic')" class="sr-only" role="status" aria-label="Detected notes" aria-atomic="true">
    {{ noteText || 'No held notes' }}
  </p>
</template>
