<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useLoop } from '@tresjs/core'
import {
  BoxGeometry,
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
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { LANE_COLORS, stageClock } from '#shared/stage/clock'
import type { Fan } from '#shared/stage/types'
import { shadeFaces } from '#shared/stage/formShade'

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

type Seat = {
  userid: string, used: boolean, y: number, vy: number, boost: number,
  phase: number, rate: number, shirt: number, since: number
}
const seats: Seat[] = slots.map((_, i) => ({
  userid: '', used: false, y: GROUND, vy: 0, boost: 0,
  phase: (i * 2.399) % (Math.PI * 2), rate: 5.5 + ((i * 37) % 10) / 10 * 2.5, shirt: i % LANE_COLORS.length, since: 0,
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

const headGeo = new BoxGeometry(0.32, 0.32, 0.32)
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
  seat.y = drop ? GROUND + 2 + Math.random() * 0.4 : GROUND
  seat.vy = 0
  seat.boost = drop ? 0.6 : 0
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
const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  const dt = Math.min(delta, 0.05)
  clock += dt
  for (const fan of stageClock.arrivals.splice(0)) seatFor(fan, true)

  const calm = stageClock.reducedMotion
  const drive = stageClock.playing ? stageClock.bass : 0
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
    // Falling in after a vote.
    if (seat.y > GROUND || seat.vy > 0) {
      seat.vy -= 14 * dt
      seat.y = Math.max(GROUND, seat.y + seat.vy * dt)
      if (seat.y === GROUND) seat.vy = 0
    }
    seat.boost = Math.max(0, seat.boost - dt * 0.9)
    // Bounce with the bass while the song plays; a gentle sway otherwise.
    const beat = Math.max(0, Math.sin(clock * seat.rate + seat.phase))
    const hop = calm ? 0 : beat * (0.03 + drive * 0.32) + seat.boost * beat * 0.5
    const sway = Math.sin(clock * 1.3 + seat.phase) * (calm ? 0.02 : 0.05)
    dummy.position.set(spot.x + sway, seat.y + hop, spot.z)
    dummy.rotation.set(0, Math.PI + sway * 2, sway)
    dummy.scale.setScalar(1)
    dummy.updateMatrix()
    bodies.setMatrixAt(i, dummy.matrix)
    dummy.position.y += 1.04
    dummy.updateMatrix()
    heads.setMatrixAt(i, dummy.matrix)
  }
  bodies.instanceMatrix.needsUpdate = true
  heads.instanceMatrix.needsUpdate = true
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true
})

onBeforeUnmount(() => {
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
