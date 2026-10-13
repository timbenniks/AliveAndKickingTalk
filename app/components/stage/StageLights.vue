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
import { stageClock } from '#shared/stage/clock'

const deckY = (z: number) => z * Math.tan(0.36)

const props = defineProps<{
  primary: string
  secondary: string
  rich: boolean
}>()

const group = new Group()
const ambient = new AmbientLight('#ffd2c2', 0.22)
const hemi = new HemisphereLight('#ff5a78', '#14080c', 0.45)
const crimson = new PointLight('#ff2438', 8, 16, 2)
crimson.position.set(-3.4, 2.6, 7)
const violet = new PointLight('#b026ff', 6, 16, 2)
violet.position.set(3.6, 2.4, 9)
const bulb = new PointLight('#ffb15a', 4, 8, 2)
bulb.position.set(-1.4, 2.1, 4.5)
const wash = new SpotLight('#ff2d3a', 10, 30, 0.9, 0.85, 1.2)
wash.position.set(0.2, 7.4, 0.4)
wash.target.position.set(0, 0.15, 10)
const key = new SpotLight('#ffe6cc', 10, 22, 0.9, 0.35, 1)
key.position.set(-1.6, 4.8, -0.6)
key.target.position.set(0, 0.1, 7)
const accent = new PointLight(props.primary, 2, 9, 2)
accent.position.set(0, 2.4, 7)
if (props.rich) {
  wash.castShadow = true
  wash.shadow.mapSize.set(512, 512)
  wash.shadow.bias = -0.0008
  wash.shadow.camera.near = 1
  wash.shadow.camera.far = 24
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

const washRest = new Color('#ff2d3a')
const flashColor = new Color()
let beat = 0
let chase = 0
let cooldown = 0

const { onBeforeRender } = useLoop()
onBeforeRender(() => {
  const live = stageClock.analysis === 'live' && stageClock.playing
  const drive = live ? stageClock.energy : 0.08
  const bass = live ? stageClock.bass : 0
  accent.color.set(props.primary)
  violet.color.set(props.secondary)
  crimson.intensity = 4 + drive * 6 + bass * 3
  violet.intensity = 3 + drive * 5
  accent.intensity = 0.8 + drive * 2
  key.intensity = 3.5 + drive * 2.5 + bass * 1.5
  bulb.intensity = 2 + (live ? stageClock.mid : 0) * 2

  cooldown = Math.max(0, cooldown - 0.016)
  const onset = live ? stageClock.onset : 0
  const kick = onset > 0.06 && cooldown === 0
  if (kick) {
    beat = Math.min(0.45, beat + 0.12)
    chase = (chase + 1) % heads.length
    cooldown = 0.55
  } else {
    beat *= 0.985
  }

  const time = stageClock.time
  heads.forEach((head, index) => {
    const hot = index === chase
    const punch = stageClock.reducedMotion ? beat * 0.35 : beat
    const pulse = 0.16 + drive * 0.35 + punch * (hot ? 0.4 : 0.08)
    const color = hot ? props.primary : canColors[index] ?? '#ffffff'
    flashColor.set(color)
    const across = stageClock.reducedMotion ? 0.7 : 0.45 + (0.5 + 0.5 * Math.sin(time * 0.28 + head.phase)) * 0.9
    const aimX = head.side * across
    const aimZ = head.z - 0.2 + Math.cos(time * 0.22 + head.phase) * (stageClock.reducedMotion ? 0 : 0.8)
    const aimY = deckY(aimZ) + 0.25
    head.spot.target.position.set(aimX, aimY, aimZ)
    head.spot.color.lerp(flashColor, 0.04)
    head.spot.intensity = live ? 1.4 + pulse * 5 : 0.7
  })

  wash.color.copy(washRest).lerp(flashColor.set(props.primary), Math.min(0.35, beat * 0.2 + bass * 0.08))
  wash.intensity = 5 + drive * 4 + beat * 2
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
