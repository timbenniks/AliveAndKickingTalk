<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useLoop } from '@tresjs/core'
import {
  BoxGeometry,
  Matrix4,
  Group,
  Mesh,
  RepeatWrapping,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  Object3D,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { LANE_COLORS, stageClock } from '#shared/stage/clock'
import type { Fan } from '#shared/stage/types'
import { shadeFaces } from '#shared/stage/formShade'
import { onMoment } from '#shared/stage/moments'

// The mosh pit: one voxel fan per voter, standing in the dark either side of
// the highway so the fretboard runs through the crowd. Heads wear the voter's
// avatar at 16x16. Fans bounce with the song's bass; a new vote drops in.
const props = defineProps<{ seed: Fan[] }>()

const MAX = 128
const COLS = 16
const ROWS = MAX / COLS
const CELL = 16
const GROUND = -0.55

// Two wedges of the pit beside the highway, nearest row first. Rows get
// wider and looser with distance so every fan stays in view.
const slots = (() => {
  const spots: Array<{ x: number, z: number }> = []
  for (let row = 0; spots.length < MAX; row++) {
    const spacing = 0.56 + row * 0.07
    for (let col = 0; col < 7; col++) {
      for (const side of [-1, 1]) {
        const jitter = ((row * 7 + col * 13) % 5) / 5 - 0.4
        spots.push({ x: side * (2.7 + col * spacing + (row % 2) * spacing * 0.5 + jitter * 0.15), z: 3.8 + row * 0.85 + jitter * 0.25 })
      }
    }
  }
  return spots.slice(0, MAX)
})()

// A stage dive: a ballistic arc from the launch point into the seat, with
// whole flips (and maybe a pirouette) so the fan always lands upright.
type Dive = {
  t: number, duration: number, x: number, y: number, z: number,
  apex: number, flips: number, axis: 'x' | 'z', twirl: number
}
// A crowd surf: lifted flat over the heads, carried out along the wedge and
// back to the same spot.
type Surf = { t: number, duration: number, reach: number, roll: number }
type Seat = {
  userid: string, used: boolean, boost: number,
  phase: number, rate: number, shirt: number, since: number, dive: Dive | null, surf: Surf | null
}
const seats: Seat[] = slots.map((_, i) => ({
  userid: '', used: false, boost: 0,
  phase: (i * 2.399) % (Math.PI * 2), rate: 5.5 + ((i * 37) % 10) / 10 * 2.5, shirt: i % LANE_COLORS.length, since: 0, dive: null, surf: null,
}))

// Avatar atlas: 16x8 cells of 16px, one per seat.
const atlas = document.createElement('canvas')
atlas.width = COLS * CELL
atlas.height = ROWS * CELL
const ink = atlas.getContext('2d', { willReadFrequently: false })!
ink.imageSmoothingEnabled = true
const texture = new CanvasTexture(atlas)
texture.magFilter = NearestFilter
texture.minFilter = NearestFilter
texture.generateMipmaps = false
texture.colorSpace = SRGBColorSpace

function drawFallback(seat: number) {
  const x = (seat % COLS) * CELL
  const y = Math.floor(seat / COLS) * CELL
  ink.fillStyle = '#2c2348'
  ink.fillRect(x, y, CELL, CELL)
  ink.fillStyle = '#a99fbb'
  ink.fillRect(x + 4, y + 3, 8, 8)
  ink.fillRect(x + 2, y + 12, 12, 4)
  ink.fillStyle = '#14080c'
  ink.fillRect(x + 6, y + 6, 1, 2)
  ink.fillRect(x + 9, y + 6, 1, 2)
  texture.needsUpdate = true
}

function drawAvatar(seat: number, src: string) {
  drawFallback(seat)
  if (!src) return
  const image = new Image()
  // Every avatar host the app sees (GitHub, X, LinkedIn) sends CORS headers.
  image.crossOrigin = 'anonymous'
  image.onload = () => {
    if (!seats[seat]?.used) return
    const side = Math.min(image.naturalWidth, image.naturalHeight)
    ink.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side,
      (seat % COLS) * CELL, Math.floor(seat / COLS) * CELL, CELL, CELL)
    texture.needsUpdate = true
  }
  image.src = src
}

// Bodies: legs, torso and two raised arms, merged into one voxel figure.
function block(w: number, h: number, d: number, x: number, y: number) {
  const box = new BoxGeometry(w, h, d)
  box.translate(x, y, 0)
  return box
}
const bodyGeo = mergeGeometries([
  block(0.13, 0.3, 0.14, -0.09, 0.15),
  block(0.13, 0.3, 0.14, 0.09, 0.15),
  block(0.36, 0.34, 0.2, 0, 0.47),
  block(0.1, 0.32, 0.1, -0.24, 0.72),
  block(0.1, 0.32, 0.1, 0.24, 0.72),
])!
// Faceted like the fretboard so lit tops read against the dark backdrop, and a
// little self-light in the shirt color so bodies never sink into the background.
const bodyMat = shadeFaces(new MeshStandardMaterial({ roughness: 0.7, metalness: 0, emissive: '#2c2348', emissiveIntensity: 0.6 }))
const bodies = new InstancedMesh(bodyGeo, bodyMat, MAX)

const headGeo = new BoxGeometry(0.44, 0.44, 0.44)
const cells = new Float32Array(MAX * 2)
slots.forEach((_, i) => {
  cells[i * 2] = i % COLS
  cells[i * 2 + 1] = ROWS - 1 - Math.floor(i / COLS)
})
headGeo.setAttribute('atlasCell', new InstancedBufferAttribute(cells, 2))
// Slightly under white so faces stay readable and below the bloom threshold.
const headMat = new MeshBasicMaterial({ map: texture, color: '#d8d8d8' })
headMat.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec2 atlasCell;')
    .replace('#include <uv_vertex>', `#include <uv_vertex>\nvMapUv = (uv + atlasCell) * vec2(${1 / COLS}, ${1 / ROWS});`)
}
const heads = new InstancedMesh(headGeo, headMat, MAX)

for (const mesh of [bodies, heads]) {
  mesh.instanceMatrix.setUsage(DynamicDrawUsage)
  mesh.frustumCulled = false
  mesh.count = 0
}
const shirt = new Color()
// Dark shirts in the fret colors: the faces carry the crowd, not the bodies.
seats.forEach((seat, i) => bodies.setColorAt(i, shirt.set(LANE_COLORS[seat.shirt]!).multiplyScalar(0.6)))

// A riser under each wedge: dark pixel tiles and a lighter front lip.
const risers = new Group()
const tiles = document.createElement('canvas')
tiles.width = tiles.height = 16
const tile = tiles.getContext('2d')!
tile.fillStyle = '#14080c'
tile.fillRect(0, 0, 16, 16)
tile.fillStyle = '#241c3d'
tile.fillRect(1, 1, 7, 7)
tile.fillRect(9, 9, 6, 6)
tile.fillStyle = '#1e1733'
tile.fillRect(9, 1, 6, 7)
tile.fillRect(1, 9, 7, 6)
const tileMap = new CanvasTexture(tiles)
tileMap.magFilter = tileMap.minFilter = NearestFilter
tileMap.generateMipmaps = false
tileMap.colorSpace = SRGBColorSpace
tileMap.wrapS = tileMap.wrapT = RepeatWrapping
const deckMat = shadeFaces(new MeshStandardMaterial({ map: tileMap, roughness: 0.85, metalness: 0.05 }))
const lipMat = shadeFaces(new MeshStandardMaterial({ color: '#2c2348', roughness: 0.6 }))
const riserParts: BoxGeometry[] = []
const DECK = { inner: 2.35, outer: 11.5, near: 3.2, far: 13.2, height: 0.3 }
for (const side of [-1, 1]) {
  const width = DECK.outer - DECK.inner
  const depth = DECK.far - DECK.near
  const deckGeo = new BoxGeometry(width, DECK.height, depth)
  tileMap.repeat.set(width / 0.8, depth / 0.8)
  const deck = new Mesh(deckGeo, deckMat)
  deck.position.set(side * (DECK.inner + width / 2), GROUND - DECK.height / 2, DECK.near + depth / 2)
  // The front edge faces the audience: a lighter lip.
  const lipGeo = new BoxGeometry(width, DECK.height + 0.06, 0.16)
  const lip = new Mesh(lipGeo, lipMat)
  lip.position.set(side * (DECK.inner + width / 2), GROUND - DECK.height / 2 + 0.03, DECK.near - 0.08)
  risers.add(deck, lip)
  riserParts.push(deckGeo, lipGeo)
}

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]!
const between = (min: number, max: number) => min + Math.random() * (max - min)

// Most fans dive off the stage (the highway); some get thrown in from the
// back of the pit. Heights, distances and flips all vary.
function launch(spot: { x: number, z: number }): Dive {
  const side = Math.sign(spot.x)
  const fromStage = Math.random() < 0.65
  const apex = between(1.1, 3.6)
  return {
    t: 0,
    duration: 0.75 + apex * 0.2 + between(0, 0.25),
    x: fromStage ? side * between(0.4, 1.7) : side * between(9, 11.5),
    y: fromStage ? between(1.2, 2.1) : between(0.4, 1.4),
    z: spot.z + between(-1.2, 1.6),
    apex,
    flips: pick([0, 1, 1, 1, 2, 2, 3]) * (Math.random() < 0.5 ? -1 : 1),
    axis: Math.random() < 0.6 ? 'z' : 'x',
    twirl: pick([0, 0, 1, -1]),
  }
}

// When a diver lands, the fans around them jump to catch.
function catchDiver(index: number) {
  const here = slots[index]!
  seats.forEach((seat, i) => {
    const spot = slots[i]!
    if (seat.used && Math.hypot(spot.x - here.x, spot.z - here.z) < 1.4) seat.boost = Math.max(seat.boost, i === index ? 1 : 0.7)
  })
}

// One surfer at a time, picked from the newest voters.
function startSurf() {
  if (seats.some(seat => seat.surf)) return
  const ready = seats
    .map((seat, i) => ({ seat, i }))
    .filter(({ seat }) => seat.used && !seat.dive)
    // Newest first; among equals (the seeded crowd) the front rows, nearest the camera.
    .sort((a, b) => b.seat.since - a.seat.since || a.i - b.i)
    .slice(0, 8)
  if (!ready.length) return
  const { seat, i } = pick(ready)
  const side = Math.sign(slots[i]!.x)
  seat.surf = {
    t: 0,
    duration: between(4.5, 5.5),
    // Out toward the far edge of the wedge.
    reach: side * Math.max(1.5, 9.6 - Math.abs(slots[i]!.x)),
    roll: stageClock.reducedMotion ? 0 : between(0.15, 0.3) * (Math.random() < 0.5 ? -1 : 1),
  }
}

let nextSurfIn = between(15, 20)
const stopMoments = onMoment((moment) => {
  if (moment.kind === 'surf') startSurf()
  if (moment.kind === 'jump') seats.forEach((seat) => { if (seat.used) seat.boost = 1 })
})

const pivotUp = new Matrix4().makeTranslation(0, 0.55, 0)
const pivotDown = new Matrix4().makeTranslation(0, -0.55, 0)
const headOffset = new Matrix4().makeTranslation(0, 1.1, 0)
const spin = new Matrix4()
const twirl = new Matrix4()
const lie = new Matrix4()
const roll = new Matrix4()
const bodyMatrix = new Matrix4()
const headMatrix = new Matrix4()

let filled = 0
let clock = 0

function seatFor(fan: Fan, drop: boolean) {
  const known = seats.findIndex(seat => seat.used && seat.userid === fan.userid)
  if (known >= 0) {
    // A fan who votes again jumps for it.
    seats[known]!.boost = 1
    return
  }
  // Live votes take the free spot nearest the stage; the seed fills from the
  // back, so the front rows stay open for the people voting right now.
  let index = drop ? seats.findIndex(seat => !seat.used) : seats.findLastIndex(seat => !seat.used)
  if (index < 0) {
    // Pit is full: the longest-standing fan makes room.
    index = seats.reduce((oldest, seat, i) => seat.since < seats[oldest]!.since ? i : oldest, 0)
  }
  const seat = seats[index]!
  seat.used = true
  seat.userid = fan.userid
  seat.since = clock
  seat.boost = 0
  seat.dive = drop ? launch(slots[index]!) : null
  seat.surf = null
  drawAvatar(index, fan.avatar)
  filled = MAX
  bodies.count = heads.count = MAX
}

watch(() => props.seed, (fans) => {
  seats.forEach(seat => { seat.used = false; seat.userid = '' })
  // Oldest first, so the newest voters end up nearest the front.
  for (const fan of fans.slice(0, MAX - 16).reverse()) seatFor(fan, false)
}, { immediate: true })

const dummy = new Object3D()
const xAxis = new Vector3(1, 0, 0)
const zAxis = new Vector3(0, 0, 1)
const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  const dt = Math.min(delta, 0.05)
  clock += dt
  for (const fan of stageClock.arrivals.splice(0)) seatFor(fan, true)

  const calm = stageClock.reducedMotion
  const drive = stageClock.playing ? stageClock.bass : 0
  // Someone goes crowd surfing every 15 to 20 seconds while the song plays.
  // Real seconds (not the animation-capped dt), so slow renderers keep pace.
  if (stageClock.playing && !calm) {
    nextSurfIn -= Math.min(delta, 0.25)
    if (nextSurfIn <= 0) {
      startSurf()
      nextSurfIn = between(15, 20)
    }
  }
  for (let i = 0; i < filled; i++) {
    const seat = seats[i]!
    const spot = slots[i]!
    if (!seat.used) {
      dummy.scale.setScalar(0)
      dummy.updateMatrix()
      bodies.setMatrixAt(i, dummy.matrix)
      heads.setMatrixAt(i, dummy.matrix)
      continue
    }
    seat.boost = Math.max(0, seat.boost - dt * 0.9)
    const sway = Math.sin(clock * 1.3 + seat.phase) * (calm ? 0.02 : 0.05)
    const dive = seat.dive
    if (dive) {
      dive.t += dt
      const p = Math.min(1, dive.t / dive.duration)
      const turn = p * p * (3 - 2 * p)
      dummy.position.set(
        dive.x + (spot.x - dive.x) * p,
        dive.y + (GROUND - dive.y) * p + 4 * dive.apex * p * (1 - p),
        dive.z + (spot.z - dive.z) * p,
      )
      dummy.rotation.set(0, Math.PI, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      // Flip around the body's middle, not its feet.
      spin.makeRotationAxis(dive.axis === 'x' ? xAxis : zAxis, dive.flips * Math.PI * 2 * turn)
      twirl.makeRotationY(dive.twirl * Math.PI * 2 * turn)
      bodyMatrix.copy(dummy.matrix).multiply(pivotUp).multiply(twirl).multiply(spin).multiply(pivotDown)
      if (p >= 1) {
        seat.dive = null
        catchDiver(i)
      }
    } else if (seat.surf) {
      const surf = seat.surf
      surf.t += dt
      const p = Math.min(1, surf.t / surf.duration)
      // Lift, carry out and back, set down.
      const up = Math.min(1, p / 0.12, (1 - p) / 0.12)
      const lift = up * up * (3 - 2 * up)
      const out = Math.sin(Math.PI * Math.min(1, Math.max(0, (p - 0.08) / 0.84)))
      const x = spot.x + surf.reach * out
      const z = spot.z + Math.sin(p * Math.PI * 3) * 0.25 * lift
      dummy.position.set(x, GROUND + lift * (1.2 + Math.sin(clock * 6) * 0.06), z)
      dummy.rotation.set(0, Math.PI, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      // Tip back to lie flat as they go up, rocking a little on the hands.
      lie.makeRotationX(-Math.PI / 2 * lift)
      roll.makeRotationZ(Math.sin(clock * 3) * surf.roll * lift)
      bodyMatrix.copy(dummy.matrix).multiply(pivotUp).multiply(roll).multiply(lie).multiply(pivotDown)
      // Arms up underneath as the surfer passes.
      seats.forEach((other, j) => {
        const below = slots[j]!
        if (j !== i && other.used && Math.hypot(below.x - x, below.z - z) < 1.1) other.boost = Math.max(other.boost, 0.6)
      })
      if (p >= 1) seat.surf = null
    } else {
      // Bounce with the bass while the song plays; a gentle sway otherwise.
      const beat = Math.max(0, Math.sin(clock * seat.rate + seat.phase))
      const hop = calm ? 0 : beat * (0.03 + drive * 0.32) + seat.boost * beat * 0.5
      dummy.position.set(spot.x + sway, GROUND + hop, spot.z)
      dummy.rotation.set(0, Math.PI + sway * 2, sway)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      bodyMatrix.copy(dummy.matrix)
    }
    bodies.setMatrixAt(i, bodyMatrix)
    heads.setMatrixAt(i, headMatrix.copy(bodyMatrix).multiply(headOffset))
  }
  bodies.instanceMatrix.needsUpdate = true
  heads.instanceMatrix.needsUpdate = true
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true
})

onBeforeUnmount(() => {
  stopMoments()
  for (const part of riserParts) part.dispose()
  for (const item of [deckMat, lipMat, tileMap]) item.dispose()
  bodyGeo.dispose()
  headGeo.dispose()
  bodyMat.dispose()
  headMat.dispose()
  texture.dispose()
})
</script>

<template>
  <primitive :object="risers" />
  <primitive :object="bodies" />
  <primitive :object="heads" />
</template>
