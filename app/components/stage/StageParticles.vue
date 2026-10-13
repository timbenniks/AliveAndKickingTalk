<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { useLoop } from '@tresjs/core'
import { BufferAttribute, BufferGeometry, Points, PointsMaterial } from 'three'
import { stageClock } from '#shared/stage/clock'

const props = defineProps<{
  primary: string
  particles: number
}>()

const COUNT = 80
const seeds = Array.from({ length: COUNT }, () => ({
  x: (Math.random() - 0.5) * 12,
  y: 0.4 + Math.random() * 5.2,
  z: Math.random() * 32,
  phase: Math.random() * Math.PI * 2,
}))
const geometry = new BufferGeometry()
geometry.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 3), 3))
const material = new PointsMaterial({
  color: props.primary,
  size: 0.07,
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
})
const points = new Points(geometry, material)

const { onBeforeRender } = useLoop()
onBeforeRender(({ elapsed }) => {
  const attr = geometry.getAttribute('position') as BufferAttribute
  const energy = stageClock.analysis === 'live' ? stageClock.energy : 0.04
  const visibleCount = stageClock.reducedMotion ? 16 : Math.floor(18 + props.particles * 62)
  for (let i = 0; i < COUNT; i++) {
    const seed = seeds[i]!
    if (i >= visibleCount) {
      attr.setXYZ(i, 0, -20, 0)
      continue
    }
    const drift = stageClock.reducedMotion ? 0 : Math.sin(elapsed * 0.5 + seed.phase) * 0.18
    attr.setXYZ(i, seed.x, seed.y + drift + energy * (0.4 + seed.phase), seed.z)
  }
  attr.needsUpdate = true
  material.color.set(props.primary)
  material.opacity = stageClock.reducedMotion ? 0.2 : 0.25 + energy * 0.65
})

onBeforeUnmount(() => {
  geometry.dispose()
  material.dispose()
})
</script>

<template>
  <primitive :object="points" />
</template>
