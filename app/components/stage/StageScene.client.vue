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
import StageMoments from './StageMoments.vue'
import StageCrowd from './StageCrowd.vue'
import StageSet from './StageSet.vue'
import StageLedWall from './StageLedWall.vue'
import StageBeams from './StageBeams.vue'
import StageMeter from './StageMeter.vue'
import type { Fan } from '#shared/stage/types'
import type { StageEffect } from '#shared/stage/styles'
import { BloomPmndrs, EffectComposerPmndrs, VignettePmndrs } from '@tresjs/post-processing'

defineProps<{
  marks: ChapterMark[]
  resetKey: string
  theme: ThemeLook
  effect: StageEffect
  gems: string[]
  dpr: number
  // The song's artwork, shown on the LED wall.
  art: string[]
  rich: boolean
  solo: boolean
  // Live screen only: the voters who form the mosh pit, and the crowd meter.
  crowd?: Fan[]
  meter?: boolean
  showNotes?: boolean
}>()

const emit = defineEmits<{ error: [] }>()
</script>

<template>
  <TresCanvas
    :clear-color="'#000000'"
    :dpr="dpr"
    antialias
    @error="emit('error')"
  >
    <CameraRig :background="theme.background" :shake="theme.cameraShake" :rich="rich" :solo="solo" />
    <StageLights :primary="theme.primary" :secondary="theme.secondary" :rich="rich" :solo="solo" />
    <StageSet :primary="theme.primary" :secondary="theme.secondary" />
    <StageLedWall :art="art" :primary="theme.primary" :secondary="theme.secondary" :rich="rich" />
    <StageBeams :solo="solo" :primary="theme.primary" :secondary="theme.secondary" :rich="rich" />
    <StageEnvironment />
    <StageSides :effect="effect" :primary="theme.primary" :secondary="theme.secondary" />
    <NoteHighway :reset-key="resetKey" :gems="gems" :show-notes="showNotes" />
    <ChapterGates :marks="marks" />
    <StageParticles :primary="theme.primary" :particles="theme.particles" />
    <StageMoments />
    <StageCrowd v-if="crowd" :seed="crowd" />
    <StageMeter v-if="meter" />
    <!-- High quality only. Bloom is thresholded so only the lit parts glow:
         gems, frets, strings and light heads, never the board or the art. -->
    <Suspense v-if="rich">
      <EffectComposerPmndrs :multisampling="4">
        <BloomPmndrs :intensity="1.15" :luminance-threshold="0.62" :luminance-smoothing="0.2" :radius="0.72" mipmap-blur />
        <VignettePmndrs :darkness="0.5" :offset="0.32" />
      </EffectComposerPmndrs>
    </Suspense>
  </TresCanvas>
</template>
