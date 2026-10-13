<script setup lang="ts">
import { useLoop, useTres } from '@tresjs/core'
import { ACESFilmicToneMapping, Fog, PCFShadowMap, type Scene } from 'three'
import { stageClock } from '#shared/stage/clock'

const props = defineProps<{
  background: string
  shake: number
  transparent: boolean
  rich: boolean
}>()

const CELLAR = '#000000'
const tres = useTres()
const { onBeforeRender } = useLoop()
let fogReady = false
let lookReady = false

onBeforeRender(({ elapsed }) => {
  const cam = tres.camera.value
  if (!cam) return
  const live = stageClock.analysis === 'live' && stageClock.playing && !stageClock.reducedMotion
  const drive = live ? stageClock.energy : 0
  const shake = stageClock.reducedMotion ? 0 : props.shake * drive
  cam.position.set(Math.sin(elapsed * 1.4) * 0.04 * shake, 1.4 + drive * 0.03, -2.2)
  cam.lookAt(0, 2.4, 4)
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
  if ('setClearColor' in tres.renderer) {
    if (props.transparent) tres.renderer.setClearColor(0x000000, 0)
    else tres.renderer.setClearColor(CELLAR, 1)
  }
})
</script>

<template>
  <TresPerspectiveCamera :fov="58" :near="0.08" :far="80" :position="[0, 1.4, -2.2]" />
</template>
