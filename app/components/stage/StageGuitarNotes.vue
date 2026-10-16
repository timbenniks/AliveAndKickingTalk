<script setup lang="ts">
// Reuse the detector's throttled readout; this adds no audio analysis or loop.
const stage = useStageAudio();
const { showGuitarNotes } = useRigDisplay();
const noteText = computed(() => stage.laneSource.value === 'midi' ? stage.midiNotes.value : stage.guitarNotes.value);
const notes = computed(() => noteText.value ? noteText.value.split(' · ') : []);
</script>

<template>
  <aside v-if="showGuitarNotes && (stage.laneSource.value === 'midi' || (stage.laneSource.value === 'guitar' && stage.guitarMode.value === 'polyphonic'))" class="guitar-notes" aria-label="Guitar notes">
    <header>
      <h2>Guitar notes</h2>
      <button type="button" aria-label="Hide guitar notes" @click="showGuitarNotes = false">×</button>
    </header>
    <div class="guitar-notes-notes" role="status" aria-label="Detected notes" aria-atomic="true">
      <span v-for="note in notes" :key="note" class="guitar-notes-note">{{ note }}</span>
      <span v-if="!notes.length" class="guitar-notes-empty">Play a note…</span>
    </div>
    <p>{{ stage.laneSource.value === 'midi' ? stage.midiInput.status.value : stage.guitarStatus.value }}</p>
  </aside>
</template>

<style scoped>
.guitar-notes {
  position: fixed;
  left: max(1rem, 2vw);
  bottom: 9rem;
  z-index: 5;
  width: min(280px, calc(100vw - 2rem));
  padding: 0.75rem;
  background: var(--color-night);
  border: 1px solid var(--color-tolex-hi);
  box-shadow: var(--px) var(--px) 0 var(--color-ink);
}
.guitar-notes header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.guitar-notes h2 { margin: 0; font-family: var(--font-caps); font-size: 0.75rem; color: var(--color-gold); }
.guitar-notes button { background: transparent; border: 0; color: var(--color-dust); font-size: 1.5rem; line-height: 1; padding: 0.25rem 0.5rem; cursor: pointer; }
.guitar-notes button:hover { color: var(--color-bone); }
.guitar-notes button:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; }
.guitar-notes-notes { display: flex; flex-wrap: wrap; align-items: center; gap: 0.375rem; min-height: 5rem; padding: 0.5rem 0; }
.guitar-notes-note { font-family: var(--font-pixel); font-size: 1.75rem; line-height: 1; color: var(--color-bone); background: var(--color-tolex-hi); padding: 0.375rem 0.5rem; }
.guitar-notes-empty { font-size: 1rem; color: var(--color-dust); }
.guitar-notes p { margin: 0.25rem 0 0; font-size: 0.8rem; color: var(--color-dust); overflow-wrap: anywhere; }
</style>
