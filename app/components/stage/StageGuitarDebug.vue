<script setup lang="ts">
// Reuse the detector's throttled readout; this adds no audio analysis or loop.
const stage = useStageAudio();
const { showGuitarNotes } = useRigDisplay();
const notes = computed(() => stage.guitarNotes.value ? stage.guitarNotes.value.split(' · ') : []);
</script>

<template>
  <aside v-if="showGuitarNotes && stage.laneSource.value === 'guitar' && stage.guitarMode.value === 'polyphonic'" class="guitar-debug" aria-label="Guitar note debug">
    <header>
      <h2>Guitar notes</h2>
      <button type="button" aria-label="Hide guitar note debug" @click="showGuitarNotes = false">×</button>
    </header>
    <div class="guitar-debug-notes" role="status" aria-label="Detected notes" aria-atomic="true">
      <span v-for="note in notes" :key="note" class="guitar-debug-note">{{ note }}</span>
      <span v-if="!notes.length" class="guitar-debug-empty">Play a note…</span>
    </div>
    <p>Signal {{ stage.guitarInputDb.value }} dB · gate {{ stage.guitarGateDb.value }} dB</p>
    <p>{{ stage.guitarInputDb.value < stage.guitarGateDb.value ? 'Below gate · lower the gate for quiet playing' : notes.length ? 'Tracking notes' : 'Signal above gate · listening for pitches' }}</p>
    <p>{{ stage.guitarDetectionMs.value }} ms / analysis</p>
    <p>{{ stage.guitarStatus.value }}</p>
  </aside>
</template>

<style scoped>
.guitar-debug {
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
.guitar-debug header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.guitar-debug h2 { margin: 0; font-family: var(--font-caps); font-size: 0.75rem; color: var(--color-gold); }
.guitar-debug button { background: transparent; border: 0; color: var(--color-dust); font-size: 1.5rem; line-height: 1; padding: 0.25rem 0.5rem; cursor: pointer; }
.guitar-debug button:hover { color: var(--color-bone); }
.guitar-debug button:focus-visible { outline: 2px solid var(--color-gold); outline-offset: 2px; }
.guitar-debug-notes { display: flex; flex-wrap: wrap; align-items: center; gap: 0.375rem; min-height: 5rem; padding: 0.5rem 0; }
.guitar-debug-note { font-family: var(--font-pixel); font-size: 1.75rem; line-height: 1; color: var(--color-bone); background: var(--color-tolex-hi); padding: 0.375rem 0.5rem; }
.guitar-debug-empty { font-size: 1rem; color: var(--color-dust); }
.guitar-debug p { margin: 0.25rem 0 0; font-size: 0.8rem; color: var(--color-dust); overflow-wrap: anywhere; }
</style>
