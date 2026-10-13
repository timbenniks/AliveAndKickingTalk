<script setup lang="ts">
// A face at 16x16, scaled up with hard pixels. Same look as the heads in the mosh pit.
const props = withDefaults(defineProps<{ src?: string, alt?: string, size?: number }>(), { src: '', alt: '', size: 48 });
const canvas = ref<HTMLCanvasElement | null>(null);
const failed = ref(false);

function paint() {
  const node = canvas.value;
  const ctx = node?.getContext('2d');
  if (!node || !ctx) return;
  failed.value = !props.src;
  if (!props.src) return;
  const image = new Image();
  image.onload = () => {
    ctx.clearRect(0, 0, 16, 16);
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 16, 16);
  };
  image.onerror = () => { failed.value = true; };
  image.src = props.src;
}

onMounted(paint);
watch(() => props.src, paint);
</script>

<template>
  <span class="pixel-avatar px-frame" :style="{ width: `${size}px`, height: `${size}px` }">
    <canvas v-show="!failed" ref="canvas" width="16" height="16" class="pixelated" role="img" :aria-label="alt" />
    <svg v-if="failed" viewBox="0 0 8 8" class="pixelated" role="img" :aria-label="alt || 'Fan'" shape-rendering="crispEdges">
      <rect width="8" height="8" fill="var(--color-tolex-hi)" />
      <rect x="2" y="2" width="4" height="4" fill="var(--color-dust)" />
      <rect x="3" y="3" width="1" height="1" fill="var(--color-ink)" />
      <rect x="5" y="3" width="1" height="1" fill="var(--color-ink)" />
      <rect x="1" y="6" width="6" height="2" fill="var(--color-dust)" />
    </svg>
  </span>
</template>

<style>
.pixel-avatar { --edge: var(--color-ink); display: inline-block; background: var(--color-tolex-hi); flex: none; }
.pixel-avatar canvas, .pixel-avatar svg { display: block; width: 100%; height: 100%; }
</style>
