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
import type { StageEffect } from '#shared/stage/styles'
import { BloomPmndrs, EffectComposerPmndrs, VignettePmndrs } from '@tresjs/post-processing'

defineProps<{
  marks: ChapterMark[]
  resetKey: string
  theme: ThemeLook
  effect: StageEffect
  gems: string[]
  dpr: number
  transparent: boolean
  rich: boolean
  solo: boolean
  pyroKey: number
  confettiKey: number
}>()

const emit = defineEmits<{ error: [] }>()
</script>

<template>
  <TresCanvas
    :alpha="transparent"
    :clear-alpha="transparent ? 0 : 1"
    :clear-color="'#000000'"
    :premultiplied-alpha="true"
    :dpr="dpr"
    antialias
    @error="emit('error')"
  >
    <CameraRig :background="theme.background" :shake="theme.cameraShake" :transparent="transparent" :rich="rich" :solo="solo" />
    <StageLights :primary="theme.primary" :secondary="theme.secondary" :rich="rich" />
    <StageEnvironment />
    <StageSides :effect="effect" :primary="theme.primary" :secondary="theme.secondary" />
    <NoteHighway :reset-key="resetKey" :gems="gems" />
    <ChapterGates :marks="marks" />
    <StageParticles :primary="theme.primary" :particles="theme.particles" />
    <StageMoments :pyro-key="pyroKey" :confetti-key="confettiKey" />
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
