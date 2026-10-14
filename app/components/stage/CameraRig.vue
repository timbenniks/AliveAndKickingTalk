<script setup lang="ts">
import { useLoop, useTres } from '@tresjs/core'
import { ACESFilmicToneMapping, Fog, PCFShadowMap, type Scene } from 'three'
import { stageClock } from '#shared/stage/clock'

const props = defineProps<{
  background: string
  shake: number
  rich: boolean
  // Show moment: the camera leans in on the fretboard while a solo cue runs.
  solo: boolean
}>()

const CELLAR = '#000000'
const tres = useTres()
const { onBeforeRender } = useLoop()
let fogReady = false
let lookReady = false
let push = 0

onBeforeRender(({ elapsed, delta }) => {
  const cam = tres.camera.value
  if (!cam) return
  const live = stageClock.analysis === 'live' && stageClock.playing && !stageClock.reducedMotion
  const drive = live ? stageClock.energy : 0
  const shake = stageClock.reducedMotion ? 0 : props.shake * drive
  // Ease in over about a second and a half; follow the song, so pause holds it.
  const target = props.solo && stageClock.playing && !stageClock.reducedMotion ? 1 : 0
  push += (target - push) * Math.min(1, delta * 1.6)
  const ease = push * push * (3 - 2 * push)
  cam.position.set(
    Math.sin(elapsed * 1.4) * 0.04 * shake + Math.sin(elapsed * 0.35) * 0.18 * ease,
    1.4 + drive * 0.03 - 0.28 * ease,
    -2.2 + 0.95 * ease,
  )
  cam.lookAt(0, 2.4 - 0.55 * ease, 4)
  const scene = tres.scene.value as Scene | undefined
  if (scene && !fogReady) {
    fogReady = true
    scene.fog = new Fog(CELLAR, 9, 22)
  }
  if (!lookReady && 'shadowMap' in tres.renderer) {
    lookReady = true
    tres.renderer.toneMapping = ACESFilmicToneMapping
    tres.renderer.toneMappingExposure = 1.12
    tres.renderer.shadowMap.enabled = props.rich
    tres.renderer.shadowMap.type = PCFShadowMap
    const shadows = tres.renderer.shadowMap
    if ('autoUpdate' in shadows) {
      shadows.autoUpdate = false
      if (props.rich) shadows.needsUpdate = true
    }
  }
  if ('setClearColor' in tres.renderer) tres.renderer.setClearColor(CELLAR, 1)
})
</script>

<template>
  <TresPerspectiveCamera :fov="58" :near="0.08" :far="80" :position="[0, 1.4, -2.2]" />
</template>
