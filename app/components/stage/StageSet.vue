<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useLoop } from '@tresjs/core'
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { stageClock } from '#shared/stage/clock'
import { shadeFaces } from '#shared/stage/formShade'

// The stage behind the highway: a deck the neck runs up onto, amp stacks,
// a drum riser and a lighting truss with par cans. It is a backdrop, so it
// stays dark and still; only the can lenses swell gently with the bass.
const props = defineProps<{ primary: string, secondary: string }>()

const DECK_TOP = 8.2
const DECK_FRONT = 22
const group = new Group()
const disposables: Array<{ dispose: () => void }> = []
const track = <T extends { dispose: () => void }>(item: T) => { disposables.push(item); return item }

// Out of the fog (it ends before the set), so darkness is set by the colors.
function material(color: string, glow = 0.35, map?: CanvasTexture) {
  const mat = new MeshStandardMaterial({ color, map, roughness: 0.8, metalness: 0.05, fog: false })
  mat.emissive.set(color).multiplyScalar(glow)
  if (map) mat.emissiveMap = map
  return track(shadeFaces(mat))
}

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  const geometry = new BoxGeometry(w, h, d)
  geometry.translate(x, y, z)
  return geometry
}

function add(parts: BoxGeometry[], mat: MeshStandardMaterial) {
  const geometry = mergeGeometries(parts)
  for (const part of parts) part.dispose()
  if (!geometry) return
  const mesh = new Mesh(track(geometry), mat)
  group.add(mesh)
  return mesh
}

function pixelTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat = [1, 1]) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  draw(ctx)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(repeat[0]!, repeat[1]!)
  return track(texture)
}

// Tolex panels with seams for the deck front.
const panelMap = pixelTexture(16, 16, (ctx) => {
  ctx.fillStyle = '#1e1733'
  ctx.fillRect(0, 0, 16, 16)
  ctx.fillStyle = '#241c3d'
  ctx.fillRect(1, 1, 14, 6)
  ctx.fillRect(1, 9, 14, 6)
  ctx.fillStyle = '#14080c'
  ctx.fillRect(0, 7, 16, 2)
}, [16, 4])

// Speaker grille cloth: a fine dark weave.
const grilleMap = pixelTexture(8, 8, (ctx) => {
  ctx.fillStyle = '#2c2348'
  ctx.fillRect(0, 0, 8, 8)
  ctx.fillStyle = '#1e1733'
  for (let i = 0; i < 8; i += 2) { ctx.fillRect(i, 0, 1, 8); ctx.fillRect(0, i, 8, 1) }
}, [3, 2])

const tolex = material('#1a1430', 0.3)
const deckMat = material('#ffffff', 0.25, panelMap)
const grille = material('#ffffff', 0.3, grilleMap)
const gold = material('#c99a24', 0.5)
const bone = material('#cfc6b2', 0.25)
const metal = material('#4b4f5c', 0.3)

// The deck: its front wall sits under the end of the highway and gives the
// crowd a dark, even backdrop.
add([box(34, DECK_TOP + 0.6, 12, 0, (DECK_TOP - 0.6) / 2, DECK_FRONT + 6)], deckMat)
add([box(34.2, 0.25, 0.3, 0, DECK_TOP, DECK_FRONT - 0.05)], metal)

// Amp stacks: two cabinets and a head, two per side, outside the amp-cue
// boards so the HTML boards never cover them.
const amps: BoxGeometry[] = []
const grilles: BoxGeometry[] = []
const logos: BoxGeometry[] = []
const panels: BoxGeometry[] = []
for (const side of [-1, 1]) {
  for (const [slot, x] of [11.3, 13.5].entries()) {
    const z = DECK_FRONT + 1.4 + slot * 0.3
    const cx = side * x
    for (let cab = 0; cab < 2; cab++) {
      const y = DECK_TOP + 0.9 + cab * 1.85
      amps.push(box(2.1, 1.8, 1.1, cx, y, z))
      grilles.push(box(1.8, 1.45, 0.06, cx, y, z - 0.56))
      logos.push(box(0.5, 0.14, 0.05, cx - 0.55, y + 0.55, z - 0.6))
    }
    const head = DECK_TOP + 0.9 + 2 * 1.85 - 0.45
    amps.push(box(2.1, 0.8, 1.0, cx, head, z))
    panels.push(box(1.8, 0.22, 0.05, cx, head - 0.05, z - 0.52))
    logos.push(box(0.6, 0.14, 0.05, cx, head + 0.22, z - 0.52))
  }
}
add(amps, tolex)
add(grilles, grille)
add(logos, gold)
add(panels, bone)

// Drum riser with a simple kit, centred behind the end of the highway.
const riserZ = DECK_FRONT + 6
add([box(7, 0.8, 4.4, 0, DECK_TOP + 0.4, riserZ)], deckMat)
add([box(7.1, 0.12, 0.12, 0, DECK_TOP + 0.8, riserZ - 2.2)], metal)
add([
  box(1.9, 1.9, 0.9, 0, DECK_TOP + 1.75, riserZ - 0.6), // bass drum
  box(0.9, 0.7, 0.7, -0.7, DECK_TOP + 3.05, riserZ - 0.2), // toms
  box(0.9, 0.7, 0.7, 0.7, DECK_TOP + 3.05, riserZ - 0.2),
  box(1.0, 1.0, 1.0, 1.9, DECK_TOP + 1.3, riserZ + 0.2), // floor tom
], tolex)
add([box(1.5, 1.5, 0.05, 0, DECK_TOP + 1.75, riserZ - 1.08)], bone) // front head
add([box(0.8, 0.2, 0.05, 0, DECK_TOP + 1.75, riserZ - 1.12)], gold) // logo
add([
  box(0.06, 2.6, 0.06, -2.1, DECK_TOP + 2.1, riserZ - 0.4), // cymbal stands
  box(0.06, 2.9, 0.06, 2.3, DECK_TOP + 2.25, riserZ - 0.1),
], metal)
add([
  box(1.3, 0.06, 1.3, -2.1, DECK_TOP + 3.42, riserZ - 0.4), // cymbals
  box(1.5, 0.06, 1.5, 2.3, DECK_TOP + 3.72, riserZ - 0.1),
], gold)

// Lighting truss: a square voxel lattice on two towers.
const TRUSS_Y = 23.6
const TRUSS_Z = DECK_FRONT + 4
const truss: BoxGeometry[] = []
const SPAN = 15.5
for (const dy of [-0.35, 0.35]) {
  for (const dz of [-0.35, 0.35]) truss.push(box(SPAN * 2, 0.12, 0.12, 0, TRUSS_Y + dy, TRUSS_Z + dz))
}
for (let x = -SPAN; x <= SPAN; x += 1) {
  truss.push(box(0.1, 0.7, 0.1, x, TRUSS_Y, TRUSS_Z - 0.35))
  truss.push(box(0.1, 0.1, 0.7, x, TRUSS_Y - 0.35, TRUSS_Z))
}
for (const side of [-1, 1]) {
  const x = side * SPAN
  const height = TRUSS_Y - DECK_TOP
  for (const dx of [-0.35, 0.35]) {
    for (const dz of [-0.35, 0.35]) truss.push(box(0.12, height, 0.12, x + dx, DECK_TOP + height / 2, TRUSS_Z + dz))
  }
  for (let y = DECK_TOP + 0.5; y < TRUSS_Y; y += 1) truss.push(box(0.7, 0.1, 0.1, x, y, TRUSS_Z - 0.35))
}
add(truss, metal)

// Par cans hanging under the truss. Lenses take the theme colors.
const CANS = [-11, -7.5, -4, -1.2, 1.2, 4, 7.5, 11]
add(CANS.map(x => box(0.55, 0.7, 0.55, x, TRUSS_Y - 0.85, TRUSS_Z - 0.2)), tolex)
const lensGeo = track(new BoxGeometry(0.42, 0.42, 0.06))
const lenses = CANS.map((x, index) => {
  const mat = track(new MeshStandardMaterial({ color: '#000000', roughness: 0.4, fog: false }))
  const lens = new Mesh(lensGeo, mat)
  lens.position.set(x, TRUSS_Y - 0.95, TRUSS_Z - 0.5)
  lens.rotation.x = 0.5
  group.add(lens)
  return { mat, index }
})

const lensColor = new Color()
function paintLenses() {
  for (const { mat, index } of lenses) {
    lensColor.set(index % 2 === 0 ? props.primary : props.secondary)
    mat.emissive.copy(lensColor)
  }
}
paintLenses()
watch(() => [props.primary, props.secondary], paintLenses)

// The only motion: lenses swell a little with the bass while the song plays.
let swell = 0
const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  const target = stageClock.playing && !stageClock.reducedMotion ? stageClock.bass : 0
  swell += (target - swell) * Math.min(1, delta * 4)
  for (const { mat } of lenses) mat.emissiveIntensity = 0.45 + swell * 0.5
})

onBeforeUnmount(() => {
  for (const item of disposables) item.dispose()
})
</script>

<template>
  <primitive :object="group" />
</template>
