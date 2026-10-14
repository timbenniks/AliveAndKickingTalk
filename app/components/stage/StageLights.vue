<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { useLoop } from '@tresjs/core'
import {
  AmbientLight,
  Color,
  Group,
  HemisphereLight,
  PointLight,
  SpotLight,
} from 'three'
import { advanceSolo, frameDecay, stageClock } from '#shared/stage/clock'
import { DECK_FRONT, DECK_TOP } from '#shared/stage/set'

const deckY = (z: number) => z * Math.tan(0.36)

const props = defineProps<{
  primary: string
  secondary: string
  rich: boolean
  solo: boolean
}>()

const group = new Group()
// Less flat fill; a warm key and colored side/back light give the scene depth.
const ambient = new AmbientLight('#ffd2c2', 0.12)
const hemi = new HemisphereLight('#8faaff', '#21100d', 0.32)
const crimson = new PointLight('#ff6a52', 10, 18, 2)
crimson.position.set(-5, 2.4, 8)
const violet = new PointLight('#b026ff', 10, 18, 2)
violet.position.set(5.8, 3.4, 11)
const bulb = new PointLight('#ffb15a', 4, 8, 2)
bulb.position.set(-1.4, 2.1, 4.5)
// Reuse the wash on the backline, leaving the artwork itself unlit.
const wash = new SpotLight('#91acff', 60, 32, 0.95, 0.85, 1.2)
wash.position.set(0, DECK_TOP + 9, DECK_FRONT - 3)
wash.target.position.set(0, DECK_TOP + 1, DECK_FRONT + 5)
const key = new SpotLight('#ffe6cc', 40, 24, 0.62, 0.7, 1)
key.position.set(-3, 5.8, 1)
key.target.position.set(0, deckY(8) + 0.15, 8)
const accent = new PointLight(props.primary, 10, 17, 2)
accent.position.set(0, 2.8, 13.6)
if (props.rich) {
  wash.castShadow = true
  wash.shadow.mapSize.set(512, 512)
  wash.shadow.bias = -0.0008
  wash.shadow.camera.near = 1
  wash.shadow.camera.far = 32
  key.castShadow = true
  key.shadow.mapSize.set(512, 512)
  key.shadow.bias = -0.0006
  key.shadow.camera.near = 0.8
  key.shadow.camera.far = 18
}
group.add(ambient, hemi, crimson, violet, bulb, wash, wash.target, key, key.target, accent)

const canColors = ['#ff2438', '#ffb15a', '#3aa6ff', '#b026ff', '#3dff45', '#ffe14a']
const placements = [
  { x: -2.15, z: 6.2, phase: 0.2 },
  { x: -2.25, z: 8.8, phase: 1.1 },
  { x: 2.15, z: 6.2, phase: 2.0 },
  { x: 2.25, z: 8.8, phase: 2.8 },
  { x: -2.2, z: 11.2, phase: 0.5 },
  { x: 2.2, z: 11.2, phase: 1.6 },
].map(place => ({ ...place, y: deckY(place.z) + 1.05 }))

type Head = {
  spot: SpotLight
  phase: number
  side: number
  z: number
}

const heads: Head[] = placements.map((place, index) => {
  const spot = new SpotLight(canColors[index] ?? '#ffffff', 3, 16, 0.62, 0.9, 1.2)
  spot.position.set(place.x, place.y + 1.4, place.z)
  group.add(spot, spot.target)
  return { spot, phase: place.phase, side: place.x < 0 ? 1 : -1, z: place.z }
})

const washRest = new Color('#91acff')
const flashColor = new Color()
const soloColor = new Color()
let beat = 0
let chase = 0
let cooldown = 0
let soloLevel = 0

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  soloLevel = advanceSolo(soloLevel, props.solo, delta)
  const focus = soloLevel * soloLevel * (3 - 2 * soloLevel)
  const live = stageClock.analysis === 'live' && stageClock.playing
  const drive = live ? stageClock.energy : 0.08
  const bass = live ? stageClock.bass : 0
  accent.color.set(props.primary)
  violet.color.set(props.secondary)
  crimson.intensity = (10 + drive * 12 + bass * 4) * (1 - focus * 0.35)
  violet.intensity = (10 + drive * 12) * (1 - focus * 0.35)
  accent.intensity = (10 + drive * 12) * (1 + focus * 0.35)
  key.intensity = (40 + drive * 8 + bass * 3) * (1 + focus * 0.12)
  bulb.intensity = 1.2 + (live ? stageClock.mid : 0) * 1.2

  cooldown = Math.max(0, cooldown - delta)
  const onset = live ? stageClock.onset : 0
  const kick = onset > 0.06 && cooldown === 0
  if (kick) {
    beat = Math.min(0.45, beat + 0.12)
    chase = (chase + 1) % heads.length
    cooldown = 0.55
  } else {
    beat *= frameDecay(0.985, delta)
  }

  const time = stageClock.time
  heads.forEach((head, index) => {
    const hot = index === chase
    const punch = stageClock.reducedMotion ? beat * 0.35 : beat
    const pulse = 0.16 + drive * 0.35 + punch * (hot ? 0.4 : 0.08)
    const color = hot ? props.primary : canColors[index] ?? '#ffffff'
    flashColor.set(color).lerp(soloColor.set(index % 2 === 0 ? props.primary : props.secondary), focus)
    const across = stageClock.reducedMotion ? 0.7 : 0.45 + (0.5 + 0.5 * Math.sin(time * 0.28 + head.phase * (1 - focus))) * 0.9
    const aimX = head.side * across
    const aimZ = head.z - 0.2 + Math.cos(time * 0.22 + head.phase) * (stageClock.reducedMotion ? 0 : 0.8)
    const aimY = deckY(aimZ) + 0.25
    head.spot.target.position.set(aimX, aimY, aimZ)
    head.spot.color.lerp(flashColor, 1 - frameDecay(0.96, delta))
    head.spot.intensity = live ? 1.4 + pulse * 5 : 0.7
  })

  wash.color.copy(washRest).lerp(flashColor.set(props.primary), Math.min(0.35, beat * 0.2 + bass * 0.08))
  wash.intensity = (60 + drive * 20 + beat * 8) * (1 - focus * 0.45)
})

onBeforeUnmount(() => {
  ambient.dispose()
  hemi.dispose()
  crimson.dispose()
  violet.dispose()
  bulb.dispose()
  wash.dispose()
  key.dispose()
  accent.dispose()
  for (const head of heads) head.spot.dispose()
})
</script>

<template>
  <primitive :object="group" />
</template>
