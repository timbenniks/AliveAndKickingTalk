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

// The intro starts high behind the pit, framing crowd, stage and LED wall,
// and settles into the playing view. Fog moves back with the camera.
const INTRO_SECONDS = 4.5
const INTRO_FROM = { x: 0, y: 6.2, z: -11.5, lookY: 9.5, lookZ: 22 }
let fog: Fog | null = null

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
  const since = performance.now() / 1000 - stageClock.introAt
  const t = stageClock.introAt && !stageClock.reducedMotion ? Math.min(1, since / INTRO_SECONDS) : 1
  const away = 1 - t * t * (3 - 2 * t)
  const lerp = (a: number, b: number) => a + (b - a) * away
  cam.position.set(
    lerp(Math.sin(elapsed * 1.4) * 0.04 * shake + Math.sin(elapsed * 0.35) * 0.18 * ease, INTRO_FROM.x),
    lerp(1.4 + drive * 0.03 - 0.28 * ease, INTRO_FROM.y),
    lerp(-2.2 + 0.95 * ease, INTRO_FROM.z),
  )
  cam.lookAt(0, lerp(2.4 - 0.55 * ease, INTRO_FROM.lookY), lerp(4, INTRO_FROM.lookZ))
  const scene = tres.scene.value as Scene | undefined
  if (scene && !fogReady) {
    fogReady = true
    fog = new Fog(CELLAR, 9, 22)
    scene.fog = fog
  }
  if (fog) {
    const back = -2.2 - cam.position.z
    fog.near = 9 + Math.max(0, back)
    fog.far = 22 + Math.max(0, back)
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
