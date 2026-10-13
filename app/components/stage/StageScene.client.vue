<script setup lang="ts">
import type { ThemeLook } from '#shared/stage/themes'
import type { ChapterMark } from '#shared/stage/timeline'
import CameraRig from './CameraRig.vue'
import ChapterGates from './ChapterGates.vue'
import NoteHighway from './NoteHighway.vue'
import StageEnvironment from './StageEnvironment.vue'
import StageLights from './StageLights.vue'
import StageParticles from './StageParticles.vue'
import StageSides from './StageSides.vue'
import type { StageEffect } from '#shared/stage/styles'

defineProps<{
  marks: ChapterMark[]
  resetKey: string
  theme: ThemeLook
  effect: StageEffect
  gems: string[]
  dpr: number
  transparent: boolean
  rich: boolean
}>()

const emit = defineEmits<{ error: [] }>()
</script>

<template>
  <TresCanvas
    :alpha="transparent"
    :clear-alpha="transparent ? 0 : 1"
    :clear-color="'#000000'"
    :premultiplied-alpha="!transparent"
    :dpr="dpr"
    antialias
    @error="emit('error')"
  >
    <CameraRig :background="theme.background" :shake="theme.cameraShake" :transparent="transparent" :rich="rich" />
    <StageLights :primary="theme.primary" :secondary="theme.secondary" :rich="rich" />
    <StageEnvironment />
    <StageSides :effect="effect" :primary="theme.primary" :secondary="theme.secondary" />
    <NoteHighway :reset-key="resetKey" :gems="gems" />
    <ChapterGates :marks="marks" />
    <StageParticles :primary="theme.primary" :particles="theme.particles" />
  </TresCanvas>
</template>
