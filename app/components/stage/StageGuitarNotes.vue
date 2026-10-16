<script setup lang="ts">
// Canvas note labels have an equivalent text readout for assistive technology.
const stage = useStageAudio();
const noteText = computed(() => stage.laneSource.value === 'midi' ? stage.midiNotes.value : stage.guitarNotes.value);
</script>

<template>
  <p v-if="stage.laneSource.value === 'midi' || (stage.laneSource.value === 'guitar' && stage.guitarMode.value === 'polyphonic')" class="note-announcement" role="status" aria-label="Detected notes" aria-atomic="true">
    {{ noteText || 'No held notes' }}
  </p>
</template>

<style scoped>
/* Keep this style block: open dev pages can still request the former panel's style URL. */
.note-announcement {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
</style>
