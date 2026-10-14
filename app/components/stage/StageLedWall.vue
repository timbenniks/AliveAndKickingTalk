<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useLoop } from '@tresjs/core'
import {
  BoxGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { stageClock } from '#shared/stage/clock'
import { shadeFaces } from '#shared/stage/formShade'

// The LED wall behind the drum riser: the song's artwork at 96x54 LEDs, with
// dark gaps between LEDs and seams between panels. Dimmed so it never
// competes with the highway; artwork plates cross-fade every seven seconds.
const props = defineProps<{ art: string[], primary: string, secondary: string, rich: boolean }>()

const COLS = 128
const ROWS = 72
const DOT = 4
const WIDTH = 22.5
const HEIGHT = WIDTH * ROWS / COLS
// Close behind the truss and high enough that the art clears the amp boards.
const CENTER = { y: 10.2 + HEIGHT / 2, z: 28 }
const HOLD = 7
const FADE = 1.2

// Each plate is drawn once into a small canvas; the wall blends two of them.
const plates: HTMLCanvasElement[] = []
const screen = document.createElement('canvas')
screen.width = COLS * DOT
screen.height = ROWS * DOT
const ink = screen.getContext('2d')!
const blend = document.createElement('canvas')
blend.width = COLS
blend.height = ROWS
const mix = blend.getContext('2d')!

const texture = new CanvasTexture(screen)
texture.colorSpace = SRGBColorSpace
texture.magFilter = texture.minFilter = NearestFilter
texture.generateMipmaps = false

function fallbackPlate() {
  const plate = document.createElement('canvas')
  plate.width = COLS
  plate.height = ROWS
  const ctx = plate.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, COLS, ROWS)
  gradient.addColorStop(0, props.primary)
  gradient.addColorStop(1, props.secondary)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, COLS, ROWS)
  return plate
}

// Smaller downloads: both image hosts take a width parameter.
function small(url: string) {
  if (url.includes('res.cloudinary.com')) return url.replace('q_auto,f_auto', 'q_auto,f_auto,w_320')
  if (url.includes('contentstack')) return `${url}${url.includes('?') ? '&' : '?'}width=320`
  return url
}

function loadPlate(url: string) {
  return new Promise<HTMLCanvasElement | null>((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const plate = document.createElement('canvas')
      plate.width = COLS
      plate.height = ROWS
      const ctx = plate.getContext('2d')!
      const scale = Math.max(COLS / image.naturalWidth, ROWS / image.naturalHeight)
      const w = image.naturalWidth * scale
      const h = image.naturalHeight * scale
      ctx.drawImage(image, (COLS - w) / 2, (ROWS - h) / 2, w, h)
      resolve(plate)
    }
    image.onerror = () => resolve(null)
    image.src = small(url)
  })
}

// Paint LEDs: each source pixel becomes a dot with a dark gap, panels every 12.
function paint(from: HTMLCanvasElement, to: HTMLCanvasElement | null, amount: number) {
  mix.globalAlpha = 1
  mix.drawImage(from, 0, 0)
  if (to && amount > 0) {
    mix.globalAlpha = amount
    mix.drawImage(to, 0, 0)
  }
  const pixels = mix.getImageData(0, 0, COLS, ROWS).data
  ink.fillStyle = '#06040a'
  ink.fillRect(0, 0, screen.width, screen.height)
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = (y * COLS + x) * 4
      ink.fillStyle = `rgb(${pixels[i]},${pixels[i + 1]},${pixels[i + 2]})`
      const seamX = x % 12 === 11 ? 1 : 0
      const seamY = y % 12 === 11 ? 1 : 0
      ink.fillRect(x * DOT, y * DOT, DOT - 1 - seamX, DOT - 1 - seamY)
    }
  }
  texture.needsUpdate = true
}

let current = 0
let elapsed = 0
let token = 0

async function loadAll(urls: string[]) {
  const mine = ++token
  plates.length = 0
  plates.push(fallbackPlate())
  paint(plates[0]!, null, 0)
  const loaded = (await Promise.all(urls.slice(0, 6).map(loadPlate))).filter((plate): plate is HTMLCanvasElement => !!plate)
  if (mine !== token || !loaded.length) return
  plates.length = 0
  plates.push(...loaded)
  current = 0
  elapsed = 0
  paint(plates[0]!, null, 0)
}

watch(() => props.art.join('|'), () => { void loadAll(props.art) }, { immediate: true })
watch(() => [props.primary, props.secondary], () => {
  // Only the fallback uses theme colors.
  if (plates.length === 1 && !props.art.length) { plates[0] = fallbackPlate(); paint(plates[0], null, 0) }
})

const group = new Group()
// Unlit and bright enough to read as the band's screen, still under the highway.
const screenMat = new MeshBasicMaterial({ map: texture, color: '#cfcad8', fog: false, toneMapped: false })
const wall = new Mesh(new PlaneGeometry(WIDTH, HEIGHT), screenMat)
wall.position.set(0, CENTER.y, CENTER.z)
// The camera looks down +z, so the wall turns to face it.
wall.rotation.y = Math.PI
group.add(wall)

const frameMat = shadeFaces(new MeshStandardMaterial({ color: '#1a1430', roughness: 0.8, fog: false }))
frameMat.emissive.set('#1a1430').multiplyScalar(0.3)
const frameParts = [
  new BoxGeometry(WIDTH + 0.8, 0.4, 0.5).translate(0, CENTER.y + HEIGHT / 2 + 0.2, CENTER.z + 0.1),
  new BoxGeometry(WIDTH + 0.8, 0.4, 0.5).translate(0, CENTER.y - HEIGHT / 2 - 0.2, CENTER.z + 0.1),
  new BoxGeometry(0.4, HEIGHT, 0.5).translate(-WIDTH / 2 - 0.2, CENTER.y, CENTER.z + 0.1),
  new BoxGeometry(0.4, HEIGHT, 0.5).translate(WIDTH / 2 + 0.2, CENTER.y, CENTER.z + 0.1),
]
const frameGeo = mergeGeometries(frameParts)!
for (const part of frameParts) part.dispose()
group.add(new Mesh(frameGeo, frameMat))

// Cross-fade between plates. Low quality and reduced motion hold the first.
const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  if (plates.length < 2 || !props.rich || stageClock.reducedMotion) return
  elapsed += delta
  if (elapsed < HOLD) return
  const next = (current + 1) % plates.length
  const amount = Math.min(1, (elapsed - HOLD) / FADE)
  paint(plates[current]!, plates[next]!, amount)
  if (amount >= 1) {
    current = next
    elapsed = 0
  }
})

onBeforeUnmount(() => {
  token++
  texture.dispose()
  screenMat.dispose()
  wall.geometry.dispose()
  frameGeo.dispose()
  frameMat.dispose()
})
</script>

<template>
  <primitive :object="group" />
</template>
