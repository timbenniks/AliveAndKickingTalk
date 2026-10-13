<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import {
  BoxGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { BOARD_TILT, LANE_X, NECK_LENGTH } from '#shared/stage/clock'
import { shadeFaces } from '#shared/stage/formShade'

const group = new Group()
const neck = new Group()
neck.rotation.x = BOARD_TILT
group.add(neck)
const disposables: Array<{ dispose: () => void }> = []

function track<T extends { dispose: () => void }>(item: T) {
  disposables.push(item)
  return item
}

function lit<T extends MeshStandardMaterial>(material: T, fadeTop = false) {
  return track(shadeFaces(material, fadeTop))
}

function solid(width: number, height: number, depth: number, x: number, y: number, z: number) {
  const geometry = new BoxGeometry(width, height, depth)
  geometry.translate(x, y, z)
  return geometry
}

function merged(parts: BoxGeometry[], material: MeshStandardMaterial) {
  const geometry = mergeGeometries(parts)
  for (const part of parts) part.dispose()
  if (!geometry) throw new Error('neck merge failed')
  const mesh = new Mesh(track(geometry), material)
  mesh.renderOrder = 2
  neck.add(mesh)
  return mesh
}

function pixelTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return track(new CanvasTexture(canvas))
  ctx.imageSmoothingEnabled = false
  draw(ctx, size)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.needsUpdate = true
  return track(texture)
}

const woodMap = pixelTexture(32, (ctx, size) => {
  const planks = ['#6a3818', '#4e2810', '#7a4420', '#3c1e0c', '#8a5428', '#5c3014']
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const band = planks[Math.floor(y / 2) % planks.length] ?? '#6a3818'
      ctx.fillStyle = (x * 3 + y) % 11 === 0 ? '#2a1408' : band
      ctx.fillRect(x, y, 1, 1)
    }
  }
})
const wood = lit(new MeshStandardMaterial({
  map: woodMap,
  color: '#ffffff',
  roughness: 0.72,
  metalness: 0.04,
  emissive: '#2a1008',
  emissiveIntensity: 0.12,
}), true)
const inlay = lit(new MeshStandardMaterial({ color: '#2a140c', roughness: 0.55, metalness: 0.2 }), true)
const binding = lit(new MeshStandardMaterial({ color: '#e6d2b0', roughness: 0.4, metalness: 0.15 }), true)
const fretMetal = lit(new MeshStandardMaterial({
  color: '#9aa3ad',
  roughness: 0.46,
  metalness: 0.35,
  emissive: '#5c656e',
  emissiveIntensity: 0.08,
}), true)
const fretCrown = lit(new MeshStandardMaterial({
  color: '#f4f7fa',
  roughness: 0.22,
  metalness: 0.4,
  emissive: '#d5dde6',
  emissiveIntensity: 0.2,
}), true)
const stringMetal = lit(new MeshStandardMaterial({
  color: '#8e98a2',
  roughness: 0.4,
  metalness: 0.38,
  emissive: '#4e565e',
  emissiveIntensity: 0.06,
}), true)

const mid = NECK_LENGTH / 2
const board = new Mesh(track(new BoxGeometry(3.76, 0.08, NECK_LENGTH)), wood)
board.position.set(0, 0, mid)
board.castShadow = true
board.receiveShadow = true
board.renderOrder = 2
neck.add(board)
const boardUv = board.geometry.getAttribute('uv')
if (boardUv) {
  for (let i = 0; i < boardUv.count; i++) boardUv.setXY(i, boardUv.getX(i) * 6, boardUv.getY(i) * 28)
}

merged([solid(0.18, 0.012, NECK_LENGTH, 0, 0.05, mid)], inlay)
merged([
  solid(0.045, 0.1, NECK_LENGTH, -1.89, 0.02, mid),
  solid(0.045, 0.1, NECK_LENGTH, 1.89, 0.02, mid),
], binding)
merged(LANE_X.map(x => solid(0.05, 0.036, NECK_LENGTH, x, 0.078, mid)), stringMetal)

const crowns: BoxGeometry[] = LANE_X.map(x => solid(0.022, 0.012, NECK_LENGTH, x, 0.102, mid))
const frets: BoxGeometry[] = []
for (let z = 1.4; z < NECK_LENGTH; z += 1.55) {
  frets.push(solid(3.58, 0.04, 0.07, 0, 0.052, z))
  crowns.push(solid(3.2, 0.014, 0.036, 0, 0.074, z))
}
merged(frets, fretMetal)
merged(crowns, fretCrown)

const head = new Mesh(track(new BoxGeometry(4.05, 0.16, 0.7)), lit(new MeshStandardMaterial({
  color: '#1c1014',
  roughness: 0.45,
  metalness: 0.35,
}), true))
head.position.set(0, 0.1, NECK_LENGTH + 0.2)
head.castShadow = true
head.receiveShadow = true
head.renderOrder = 2
neck.add(head)

onBeforeUnmount(() => {
  for (const item of disposables) item.dispose()
})
</script>

<template>
  <primitive :object="group" />
</template>
