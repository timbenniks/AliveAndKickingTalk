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
import { onMoment, recentTitle } from '#shared/stage/moments'
import { drawPixel, measurePixel, wrapPixel } from '#shared/stage/pixelFont'
import { LED_CENTER, LED_COLS, LED_HEIGHT, LED_ROWS, LED_WIDTH } from '#shared/stage/set'

// The LED wall behind the drum riser: the song's artwork at 96x54 LEDs, with
// dark gaps between LEDs and seams between panels. Dimmed so it never
// competes with the highway; artwork plates cross-fade every seven seconds.
const props = defineProps<{ art: string[], primary: string, secondary: string, rich: boolean }>()

const COLS = LED_COLS
const ROWS = LED_ROWS
const DOT = 4
const WIDTH = LED_WIDTH
const HEIGHT = LED_HEIGHT
const CENTER = LED_CENTER
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

// A title card (band name, ENCORE!) laid over the art in pixel letters, so it
// becomes LEDs like everything else on the wall.
// The countdown starts on the first rendered frame, so a title fired while the
// scene is still loading (the song intro) is not over before it is seen.
let title: { lines: string[], color: string, seconds: number, until: number | null } | null = null

function drawTitle() {
  if (!title) return
  // Largest scale that fits, never larger than 3 LEDs per font pixel.
  let scale = 3
  let size = measurePixel(title.lines, scale)
  while (scale > 1 && (size.width > COLS - 8 || size.height > ROWS - 8)) size = measurePixel(title.lines, --scale)
  const x = Math.round((COLS - size.width) / 2)
  const y = Math.round((ROWS - size.height) / 2)
  mix.globalAlpha = 0.72
  mix.fillStyle = '#06040a'
  mix.fillRect(0, y - 4, COLS, size.height + 8)
  mix.globalAlpha = 1
  drawPixel(mix, title.lines, x, y, scale, title.color)
}

// Paint LEDs: each source pixel becomes a dot with a dark gap, panels every 12.
function paint(from: HTMLCanvasElement, to: HTMLCanvasElement | null, amount: number) {
  mix.globalAlpha = 1
  mix.drawImage(from, 0, 0)
  if (to && amount > 0) {
    mix.globalAlpha = amount
    mix.drawImage(to, 0, 0)
  }
  mix.globalAlpha = 1
  drawTitle()
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

function repaint() {
  const plate = plates[current]
  if (plate) paint(plate, null, 0)
}

function showTitle(moment: { lines: string[], seconds: number, color?: string }) {
  const lines = moment.lines.flatMap(line => wrapPixel(line, 20))
  title = { lines, color: moment.color ?? '#f3ead6', seconds: moment.seconds, until: null }
  repaint()
}
const stopTitles = onMoment((moment) => { if (moment.kind === 'title') showTitle(moment) })
// The scene mounts after the page: pick up a title fired just before.
const pending = recentTitle()
if (pending) showTitle(pending)

// Cross-fade between plates. Low quality and reduced motion hold the first.
const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  if (title) {
    const now = performance.now() / 1000
    title.until ??= now + title.seconds
    if (now >= title.until) {
      title = null
      repaint()
    }
  }
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
  stopTitles()
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
