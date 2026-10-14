<script setup lang="ts">
import { useLoop, useTres } from '@tresjs/core'
import { ACESFilmicToneMapping, Fog, PCFShadowMap, Vector3, type Scene } from 'three'
import { advanceSolo, INTRO_SECONDS, stageClock } from '#shared/stage/clock'

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

// The intro is a crane shot: high and wide off to one side behind the crowd,
// swinging across and gliding down over the pit onto the fretboard, banking
// slightly and levelling out. Position and aim each follow a cubic curve.
const INTRO_PATH = [new Vector3(-10, 10.5, -12), new Vector3(10, 8, -9), new Vector3(3, 3, -4.5), new Vector3(0, 1.4, -2.2)]
const INTRO_LOOK = [new Vector3(0, 11, 26), new Vector3(-2, 8, 20), new Vector3(0, 3.5, 8), new Vector3(0, 2.4, 4)]
const INTRO_BANK = -0.12
let fog: Fog | null = null

// While the song plays the camera lives a little: a slow drift, and every
// ~12s it eases into the next framing. Offsets from the base view; the
// fretboard always stays centred enough to read.
const FRAMINGS = [
  { x: 0, y: 0, z: 0, lookX: 0, bank: 0 },
  { x: -0.55, y: 0.15, z: -0.2, lookX: 0.25, bank: 0.02 },
  { x: 0.2, y: -0.25, z: 0.45, lookX: -0.1, bank: 0 },
  { x: 0.6, y: 0.1, z: -0.1, lookX: -0.3, bank: -0.02 },
  { x: 0, y: 0.45, z: -0.4, lookX: 0, bank: 0 },
] as const
const FRAMING_SECONDS = 12
const BLEND_SECONDS = 4
let showClock = 0
let framing = 0
let framingAt = 0
let dip = 0

const point = new Vector3()
const look = new Vector3()
function bezier(path: Vector3[], t: number, out: Vector3) {
  const u = 1 - t
  return out.set(0, 0, 0)
    .addScaledVector(path[0]!, u * u * u)
    .addScaledVector(path[1]!, 3 * u * u * t)
    .addScaledVector(path[2]!, 3 * u * t * t)
    .addScaledVector(path[3]!, t * t * t)
}
const smooth = (t: number) => t * t * (3 - 2 * t)
const easeInOut = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

onBeforeRender(({ elapsed, delta }) => {
  const cam = tres.camera.value
  if (!cam) return
  const calm = stageClock.reducedMotion
  const live = stageClock.analysis === 'live' && stageClock.playing && !calm
  const drive = live ? stageClock.energy : 0
  const shake = calm ? 0 : props.shake * drive
  // Use the same entrance and release as the lights and beams; pause holds it.
  push = advanceSolo(push, props.solo, delta)
  const ease = smooth(push)

  // Living camera: its own clock only runs while the song plays.
  if (stageClock.playing && !calm) showClock += Math.min(delta, 0.1)
  if (showClock - framingAt > FRAMING_SECONDS) {
    framingAt = showClock
    framing = (framing + 1) % FRAMINGS.length
  }
  const from = FRAMINGS[(framing + FRAMINGS.length - 1) % FRAMINGS.length]!
  const to = FRAMINGS[framing]!
  const mix = framingAt ? smooth(Math.min(1, (showClock - framingAt) / BLEND_SECONDS)) : 1
  const frame = (key: keyof typeof to) => from[key] + (to[key] - from[key]) * mix
  // Less wandering while the solo push holds the shot.
  const roam = calm ? 0 : 1 - ease * 0.9
  const drift = {
    x: (Math.sin(showClock * 0.21) * 0.32 + Math.sin(showClock * 0.53) * 0.08) * roam,
    y: Math.sin(showClock * 0.17 + 1.3) * 0.12 * roam,
    z: Math.sin(showClock * 0.13 + 0.6) * 0.22 * roam,
    bank: Math.sin(showClock * 0.19 + 2.1) * 0.012 * roam,
  }
  // A small dip on big hits, settling quickly.
  dip = Math.max(dip * Math.pow(0.02, delta), live ? Math.min(0.08, stageClock.onset * 0.6) : 0)

  const playX = Math.sin(elapsed * 1.4) * 0.04 * shake + Math.sin(showClock * 0.35) * 0.08 * ease + frame('x') * roam + drift.x
  const playY = 1.4 + drive * 0.03 - 0.28 * ease + frame('y') * roam + drift.y - dip
  const playZ = -2.2 + 0.95 * ease + frame('z') * roam + drift.z
  const lookX = frame('lookX') * roam - drift.x * 0.3
  const lookY = 2.4 - 0.55 * ease
  const bank = (frame('bank') * roam + drift.bank)

  // Intro crane: from the curve into the living playing view.
  const since = performance.now() / 1000 - stageClock.introAt
  const t = stageClock.introAt && !calm ? Math.min(1, since / INTRO_SECONDS) : 1
  if (t < 1) {
    const k = easeInOut(t)
    bezier(INTRO_PATH, k, point)
    bezier(INTRO_LOOK, k, look)
    // Hand over smoothly to the live pose in the last part of the move.
    const hand = smooth(Math.max(0, (k - 0.75) / 0.25))
    cam.position.set(point.x + (playX - point.x) * hand, point.y + (playY - point.y) * hand, point.z + (playZ - point.z) * hand)
    cam.lookAt(look.x + (lookX - look.x) * hand, look.y + (lookY - look.y) * hand, look.z + (4 - look.z) * hand)
    cam.rotateZ(INTRO_BANK * Math.sin(Math.PI * k) + bank * hand)
  } else {
    cam.position.set(playX, playY, playZ)
    cam.lookAt(lookX, lookY, 4)
    cam.rotateZ(bank)
  }
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
