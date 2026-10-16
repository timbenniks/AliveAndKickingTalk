<script setup lang="ts">
// Canvas note labels have an equivalent text readout for assistive technology.
const stage = useStageAudio();
const noteText = computed(() => stage.laneSource.value === 'midi' ? stage.midiNotes.value : stage.guitarNotes.value);
const burst = stage.soloBurst;
const { forceReduced } = useRigDisplay();
</script>

<template>
  <p v-if="stage.laneSource.value === 'midi' || (stage.laneSource.value === 'guitar' && stage.guitarMode.value === 'polyphonic')" class="note-announcement" role="status" aria-label="Detected notes" aria-atomic="true">
    {{ noteText || 'No held notes' }}
  </p>
  <Transition name="solo-burst">
    <div v-if="burst.level > 0.15" class="solo-burst" :class="{ 'solo-burst-static': forceReduced }" aria-label="Fast note run detected">
      <span class="solo-burst-title">SOLO BURST</span>
      <span class="solo-burst-rate">{{ burst.rate ? `${burst.rate.toFixed(1)} notes / sec` : 'Let it ring' }}</span>
      <div class="solo-burst-meter" aria-hidden="true">
        <i v-for="step in 8" :key="step" :class="{ lit: step <= Math.ceil(burst.level * 8) }" />
      </div>
    </div>
  </Transition>
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
.solo-burst {
  position: absolute;
  right: max(1rem, 2vw);
  bottom: 8rem;
  z-index: 5;
  display: grid;
  gap: 0.4rem;
  padding: 0.8rem 1rem;
  color: var(--color-gold);
  background: var(--color-night);
  border: 2px solid var(--color-gold);
  box-shadow: 4px 4px 0 var(--color-ink), 0 0 24px #ffc53124;
  pointer-events: none;
}
.solo-burst-title { font-family: var(--font-pixel); font-size: 1.8rem; line-height: 1; }
.solo-burst-rate { font-family: var(--font-caps); font-size: 0.6rem; color: var(--color-bone); }
.solo-burst-meter { display: flex; gap: 4px; margin-top: 0.15rem; }
.solo-burst-meter i { width: 14px; height: 5px; background: var(--color-tolex-hi); }
.solo-burst-meter .lit { background: var(--color-gold); }
.solo-burst-enter-active, .solo-burst-leave-active { transition: opacity 0.25s, transform 0.25s; }
.solo-burst-enter-from, .solo-burst-leave-to { opacity: 0; transform: translateY(6px); }
@media (prefers-reduced-motion: reduce) {
  .solo-burst-enter-active, .solo-burst-leave-active { transition: none; }
}
.solo-burst-static { transition: none; }
</style>
