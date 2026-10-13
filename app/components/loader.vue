<template>
  <!-- Four pixels chasing round a square. Stands still with reduced motion. -->
  <div class="pixel-loader" role="status" aria-label="Loading">
    <span v-for="n in 4" :key="n" />
  </div>
</template>

<style>
.pixel-loader {
  display: inline-grid;
  grid-template-columns: repeat(2, var(--px));
  gap: var(--px);
  padding: var(--px);
}
.pixel-loader span {
  width: var(--px);
  height: var(--px);
  background: var(--color-gold);
  opacity: 0.25;
  animation: pixel-chase 0.8s steps(1) infinite;
}
/* Clockwise order: top-left, top-right, bottom-right, bottom-left. */
.pixel-loader span:nth-child(2) { animation-delay: 0.2s; }
.pixel-loader span:nth-child(4) { animation-delay: 0.4s; }
.pixel-loader span:nth-child(3) { animation-delay: 0.6s; }
@keyframes pixel-chase {
  0%, 24% { opacity: 1; }
  25%, 100% { opacity: 0.25; }
}
@media (prefers-reduced-motion: reduce) {
  .pixel-loader span { animation: none; opacity: 0.8; }
}
</style>
