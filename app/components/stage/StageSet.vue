<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useLoop } from '@tresjs/core'
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  NearestFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { stageClock } from '#shared/stage/clock'
import { shadeFaces } from '#shared/stage/formShade'
import { CANS, DECK_FRONT, DECK_TOP, TRUSS_SPAN, TRUSS_Y, TRUSS_Z } from '#shared/stage/set'

// The stage behind the highway: a deck the neck runs up onto, amp stacks,
// a drum riser and a lighting truss with par cans. It is a backdrop, so it
// stays dark and still; only the can lenses swell gently with the bass.
const props = defineProps<{ primary: string, secondary: string }>()

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

// Speaker grille cloth: a basket weave with a little sheen, like the real thing.
const grilleMap = pixelTexture(8, 8, (ctx) => {
  ctx.fillStyle = '#241c36'
  ctx.fillRect(0, 0, 8, 8)
  ctx.fillStyle = '#4a4058'
  for (let y = 0; y < 8; y += 2) for (let x = 0; x < 8; x += 2) ctx.fillRect(x + (y % 4 ? 1 : 0), y, 1, 1)
  ctx.fillStyle = '#14080c'
  for (let i = 0; i < 8; i += 4) { ctx.fillRect(i + 3, 0, 1, 8) }
}, [6, 5])

// A cream script nameplate in the style of a classic British amp logo,
// drawn small and scaled up with hard pixels.
const logoCanvas = document.createElement('canvas')
logoCanvas.width = 96
logoCanvas.height = 32
{
  const ctx = logoCanvas.getContext('2d')!
  ctx.font = 'italic bold 22px "Snell Roundhand", "Brush Script MT", "Segoe Script", cursive'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#14080c'
  ctx.fillText('Benniks', 49, 18)
  ctx.fillStyle = '#efe6d0'
  ctx.fillText('Benniks', 48, 17)
}
const logoMap = track(new CanvasTexture(logoCanvas))
logoMap.colorSpace = SRGBColorSpace
logoMap.magFilter = logoMap.minFilter = NearestFilter
logoMap.generateMipmaps = false
// Toned like the rest of the set so the script reads without blooming.
const logoMat = track(new MeshBasicMaterial({ map: logoMap, transparent: true, color: '#bdb5a2', fog: false }))

const tolex = material('#1a1430', 0.3)
const deckMat = material('#ffffff', 0.25, panelMap)
const grille = material('#ffffff', 0.3, grilleMap)
const gold = material('#c99a24', 0.5)
const bone = material('#cfc6b2', 0.25)
const metal = material('#4b4f5c', 0.3)

// The deck: its front is a wall of stacked cabinets behind the crowd.
add([box(34, DECK_TOP + 0.6, 12, 0, (DECK_TOP - 0.6) / 2, DECK_FRONT + 6)], deckMat)
add([box(34.2, 0.25, 0.3, 0, DECK_TOP, DECK_FRONT - 0.05)], metal)

// One cabinet face, drawn once: tolex border, gold piping, basket weave and
// the script nameplate. Every cab in the wall shows it.
const cabCanvas = document.createElement('canvas')
cabCanvas.width = 96
cabCanvas.height = 80
{
  const ctx = cabCanvas.getContext('2d')!
  ctx.fillStyle = '#1a1430'
  ctx.fillRect(0, 0, 96, 80)
  ctx.fillStyle = '#c99a24'
  ctx.fillRect(5, 5, 86, 70)
  ctx.fillStyle = '#241c36'
  ctx.fillRect(7, 7, 82, 66)
  ctx.fillStyle = '#4a4058'
  for (let y = 7; y < 73; y += 2) for (let x = 7; x < 89; x += 2) if ((x + y) % 4 === 0) ctx.fillRect(x, y, 1, 1)
  ctx.fillStyle = '#14080c'
  for (let x = 10; x < 89; x += 8) ctx.fillRect(x, 7, 1, 66)
  ctx.drawImage(logoCanvas, 0, 0, 96, 32, 6, 6, 60, 20)
}
const cabMap = track(new CanvasTexture(cabCanvas))
cabMap.colorSpace = SRGBColorSpace
cabMap.magFilter = cabMap.minFilter = NearestFilter
cabMap.generateMipmaps = false
// Dimmer than the stacks on the deck: a backdrop for the crowd, not a feature.
const cabFace = material('#9a94a8', 0.2, cabMap)

const COLS = 16
const ROWS = 5
const CAB_W = 34 / COLS
const CAB_H = (DECK_TOP + 0.6) / ROWS
const wallCabs: BoxGeometry[] = []
const wallFaces: PlaneGeometry[] = []
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const x = -17 + CAB_W * (col + 0.5)
    // The neck of the highway runs onto the deck here; leave room for it.
    if (Math.abs(x) < 2.4) continue
    const y = -0.6 + CAB_H * (row + 0.5)
    wallCabs.push(box(CAB_W - 0.06, CAB_H - 0.06, 0.5, x, y, DECK_FRONT - 0.2))
    const face = new PlaneGeometry(CAB_W - 0.1, CAB_H - 0.1)
    face.rotateY(Math.PI)
    face.translate(x, y, DECK_FRONT - 0.46)
    wallFaces.push(face)
  }
}
add(wallCabs, tolex)
{
  const geometry = mergeGeometries(wallFaces)
  for (const part of wallFaces) part.dispose()
  if (geometry) group.add(new Mesh(track(geometry), cabFace))
}

// Amp stacks: two cabinets and a head, two per side, outside the amp-cue
// boards so the HTML boards never cover them.
const amps: BoxGeometry[] = []
const grilles: BoxGeometry[] = []
const piping: BoxGeometry[] = []
const panels: BoxGeometry[] = []
const logos: PlaneGeometry[] = []
function logoAt(width: number, x: number, y: number, z: number) {
  const plane = new PlaneGeometry(width, width / 3)
  plane.rotateY(Math.PI)
  plane.translate(x, y, z)
  logos.push(plane)
}
for (const side of [-1, 1]) {
  for (const [slot, x] of [11.3, 13.5].entries()) {
    const z = DECK_FRONT + 1.4 + slot * 0.3
    const cx = side * x
    for (let cab = 0; cab < 2; cab++) {
      const y = DECK_TOP + 0.9 + cab * 1.85
      amps.push(box(2.1, 1.8, 1.1, cx, y, z))
      grilles.push(box(1.8, 1.45, 0.06, cx, y, z - 0.56))
      // Gold piping round the grille.
      piping.push(
        box(1.88, 0.05, 0.05, cx, y + 0.75, z - 0.6),
        box(1.88, 0.05, 0.05, cx, y - 0.75, z - 0.6),
        box(0.05, 1.5, 0.05, cx - 0.92, y, z - 0.6),
        box(0.05, 1.5, 0.05, cx + 0.92, y, z - 0.6),
      )
      logoAt(1.2, cx - 0.3, y + 0.42, z - 0.62)
    }
    const head = DECK_TOP + 0.9 + 2 * 1.85 - 0.45
    amps.push(box(2.1, 0.8, 1.0, cx, head, z))
    panels.push(box(1.8, 0.22, 0.05, cx, head - 0.2, z - 0.52))
    logoAt(1.5, cx, head + 0.12, z - 0.54)
  }
}
add(amps, tolex)
add(grilles, grille)
add(piping, gold)
add(panels, bone)
{
  const geometry = mergeGeometries(logos)
  for (const part of logos) part.dispose()
  if (geometry) group.add(new Mesh(track(geometry), logoMat))
}

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
const truss: BoxGeometry[] = []
const SPAN = TRUSS_SPAN
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
