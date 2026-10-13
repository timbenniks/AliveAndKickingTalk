<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useLoop } from '@tresjs/core'
import { BoxGeometry, CanvasTexture, Group, Mesh, MeshStandardMaterial, NearestFilter, Sprite, SpriteMaterial } from 'three'
import type { ChapterMark } from '#shared/stage/timeline'
import { formatTime } from '#shared/stage/timeline'
import { BOARD_TILT, stageClock } from '#shared/stage/clock'
import { lookFor } from '#shared/stage/themes'
import { shadeFaces } from '#shared/stage/formShade'
import { drawPixel, measurePixel, wrapPixel } from '#shared/stage/pixelFont'

const APPROACH_SECONDS = 10
const REACH = 7

const props = defineProps<{
  marks: ChapterMark[]
}>()

const group = new Group()
group.rotation.x = BOARD_TILT
group.renderOrder = 6
const barGeo = new BoxGeometry(3.58, 0.09, 0.2)
const lipGeo = new BoxGeometry(3.76, 0.04, 0.32)
const disposables: Array<{ dispose: () => void }> = []
const lipMat = shadeFaces(new MeshStandardMaterial({
  color: '#1a0c10',
  roughness: 0.86,
  metalness: 0.05,
}))
disposables.push(lipMat)

function labelTexture(name: string, when: string, color: string) {
  const title = wrapPixel(name, 16)
  const scale = title[0] && title[0].length > 12 ? 6 : 8
  const titleSize = measurePixel(title, scale)
  const timeSize = measurePixel([when], 4)
  const width = Math.max(titleSize.width, timeSize.width) + 36
  const height = 16 + titleSize.height + timeSize.height + 18
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = 'rgba(8, 4, 6, 0.92)'
  ctx.fillRect(8, 8, width - 16, height - 16)
  ctx.fillStyle = color
  ctx.fillRect(8, 8, 10, height - 16)
  ctx.fillStyle = '#f4f1e8'
  ctx.fillRect(8, 8, 10, 10)
  ctx.fillRect(width - 18, 8, 10, 10)
  ctx.fillRect(8, height - 18, 10, 10)
  ctx.fillRect(width - 18, height - 18, 10, 10)
  drawPixel(ctx, title, 26, 16, scale, '#f4f1e8')
  drawPixel(ctx, [when], 26, 16 + titleSize.height, 4, color)
  const texture = new CanvasTexture(canvas)
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

const gates = Array.from({ length: 6 }, () => {
  const material = shadeFaces(new MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#ffffff',
    emissiveIntensity: 0.32,
    roughness: 0.48,
  }))
  disposables.push(material)
  const bar = new Mesh(barGeo, material)
  bar.visible = false
  bar.renderOrder = 4
  const lip = new Mesh(lipGeo, lipMat)
  lip.visible = false
  lip.renderOrder = 3
  const spriteMat = new SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false })
  disposables.push(spriteMat)
  const sprite = new Sprite(spriteMat)
  sprite.scale.set(3.1, 0.74, 1)
  sprite.visible = false
  sprite.renderOrder = 8
  sprite.center.set(0.5, 0)
  group.add(lip, bar, sprite)
  return { bar, lip, sprite, id: '' }
})

function paint(index: number, mark: ChapterMark) {
  const gate = gates[index]
  if (!gate || gate.id === mark.id) return
  gate.id = mark.id
  const color = lookFor(mark.theme).primary
  const material = gate.bar.material as MeshStandardMaterial
  material.color.set(color)
  material.emissive.set(color)
  const map = labelTexture(mark.label, formatTime(mark.at), color)
  const spriteMat = gate.sprite.material as SpriteMaterial
  spriteMat.map?.dispose()
  spriteMat.map = map
  spriteMat.needsUpdate = true
  if (map?.image) {
    const aspect = map.image.width / map.image.height
    let worldH = 0.58
    let worldW = worldH * aspect
    if (worldW > 3.2) {
      worldH *= 3.2 / worldW
      worldW = 3.2
    }
    gate.sprite.scale.set(worldW, worldH, 1)
  }
}

watch(() => props.marks, () => {
  for (const gate of gates) gate.id = ''
})

const { onBeforeRender } = useLoop()
onBeforeRender(() => {
  let slot = 0
  const time = stageClock.time
  for (const mark of props.marks) {
    const dt = mark.at - time
    if (dt < -0.15 || dt > APPROACH_SECONDS) continue
    const z = (dt / APPROACH_SECONDS) * REACH
    const gate = gates[slot]
    if (!gate) break
    paint(slot, mark)
    gate.bar.visible = true
    gate.lip.visible = true
    gate.sprite.visible = true
    gate.lip.position.set(0, 0.02, z)
    gate.bar.position.set(0, 0.14, z)
    gate.sprite.position.set(0, 0.42, z)
    slot += 1
  }
  for (let i = slot; i < gates.length; i++) {
    gates[i]!.bar.visible = false
    gates[i]!.lip.visible = false
    gates[i]!.sprite.visible = false
  }
})

onBeforeUnmount(() => {
  barGeo.dispose()
  lipGeo.dispose()
  for (const gate of gates) (gate.sprite.material as SpriteMaterial).map?.dispose()
  for (const item of disposables) item.dispose()
})
</script>

<template>
  <primitive :object="group" />
</template>
