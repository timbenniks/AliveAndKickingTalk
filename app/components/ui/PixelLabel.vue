<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { drawPixel, measurePixel, wrapPixel } from '#shared/stage/pixelFont'

const props = withDefaults(defineProps<{
  text: string
  scale?: number
  color?: string
  maxCols?: number
}>(), {
  scale: 5,
  color: '#f4f1e8',
  maxCols: 12,
})

const canvas = ref<HTMLCanvasElement | null>(null)

function paint() {
  const node = canvas.value
  if (!node) return
  const lines = wrapPixel(props.text, props.maxCols)
  const size = measurePixel(lines, props.scale)
  node.width = size.width
  node.height = size.height
  const ctx = node.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, node.width, node.height)
  ctx.imageSmoothingEnabled = false
  drawPixel(ctx, lines, 0, 0, props.scale, props.color)
}

onMounted(paint)
watch(() => [props.text, props.scale, props.color, props.maxCols], paint)
</script>

<template>
  <canvas ref="canvas" class="pixel-label" role="img" :aria-label="text" />
</template>

<style>
.pixel-label { display: block; max-width: 100%; height: auto; image-rendering: pixelated; }
</style>
