<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { useLoop } from '@tresjs/core'
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  Sprite,
  SpriteMaterial,
} from 'three'
import { BOARD_TILT, stageClock } from '#shared/stage/clock'
import type { StageEffect } from '#shared/stage/styles'

const props = defineProps<{
  effect: StageEffect
  primary: string
  secondary: string
}>()

const group = new Group()
group.rotation.x = BOARD_TILT
group.renderOrder = 5
const disposables: Array<{ dispose: () => void }> = []

function track<T extends { dispose: () => void }>(item: T) {
  disposables.push(item)
  return item
}

function pixelFlame() {
  const canvas = document.createElement('canvas')
  canvas.width = 8
  canvas.height = 16
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const rows = [
      '---xx---',
      '--xxxx--',
      '--xxxx--',
      '-xxxxxx-',
      '-xxxxxx-',
      'xxxxxxxx',
      'xxxxxxxx',
      '-xxxxxx-',
      '-xxxxxx-',
      '--xxxx--',
      '--x--x--',
      '---xx---',
      '---xx---',
      '---x----',
      '--------',
      '--------',
    ]
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== 'x') continue
        ctx.fillStyle = y < 4 ? '#fff1c9' : y < 9 ? '#ff8c1a' : '#ff2d2d'
        ctx.fillRect(x, y, 1, 1)
      }
    })
  }
  const texture = track(new CanvasTexture(canvas))
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

function hazeTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const haze = ctx.createRadialGradient(16, 16, 2, 16, 16, 16)
    haze.addColorStop(0, 'rgba(255,255,255,0.9)')
    haze.addColorStop(0.45, 'rgba(255,255,255,0.28)')
    haze.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = haze
    ctx.fillRect(0, 0, 32, 32)
  }
  const texture = track(new CanvasTexture(canvas))
  texture.needsUpdate = true
  return texture
}

const flameMap = pixelFlame()
const hazeMap = hazeTexture()
const flameColor = new Color()
const washColor = new Color()

const flames = Array.from({ length: 14 }, (_, index) => {
  const material = track(new SpriteMaterial({
    map: flameMap,
    color: '#ff8c1a',
    transparent: true,
    opacity: 0.7,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  }))
  const sprite = new Sprite(material)
  sprite.visible = false
  sprite.renderOrder = 5
  sprite.center.set(0.5, 0)
  group.add(sprite)
  return { sprite, material, side: index < 7 ? 1 : -1, slot: index % 7, phase: index * 0.7 }
})

function driftPool(count: number, map: CanvasTexture) {
  return Array.from({ length: count }, (_, index) => {
    const material = track(new SpriteMaterial({
      map,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    }))
    const sprite = new Sprite(material)
    sprite.visible = false
    sprite.renderOrder = 4
    group.add(sprite)
    return {
      sprite,
      material,
      side: index % 2 === 0 ? 1 : -1,
      z: 1.4 + (index % (count / 2)) * 1.5,
      phase: Math.random() * Math.PI * 2,
    }
  })
}

const smoke = driftPool(16, hazeMap)
const mist = driftPool(10, hazeMap)

const discoColors = ['#ff2bd6', '#7af0ff', '#ffe14a', '#3dff45', '#ff8c1a', '#b026ff']
const discoGeo = track(new BoxGeometry(0.16, 0.16, 0.16))
const disco = Array.from({ length: 8 }, (_, index) => {
  const material = track(new MeshBasicMaterial({
    color: discoColors[index % discoColors.length],
    transparent: true,
    opacity: 0.35,
  }))
  const mesh = new Mesh(discoGeo, material)
  mesh.visible = false
  mesh.position.set(index < 4 ? 2.28 : -2.28, 0.28, 2.2 + (index % 4) * 1.7)
  group.add(mesh)
  return { mesh, material, index }
})

const embers = Array.from({ length: 28 }, (_, index) => {
  const material = track(new SpriteMaterial({
    map: flameMap,
    color: '#ff7a32',
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  }))
  const sprite = new Sprite(material)
  sprite.visible = false
  sprite.renderOrder = 5
  group.add(sprite)
  return { sprite, material, side: index % 2 === 0 ? 1 : -1, phase: index * 0.45 }
})

function hideAll() {
  for (const item of flames) item.sprite.visible = false
  for (const item of smoke) item.sprite.visible = false
  for (const item of mist) item.sprite.visible = false
  for (const item of disco) item.mesh.visible = false
  for (const item of embers) item.sprite.visible = false
}

const { onBeforeRender } = useLoop()
onBeforeRender(({ elapsed }) => {
  hideAll()
  const live = stageClock.analysis === 'live' && stageClock.playing
  const energy = live ? stageClock.energy : 0.08
  const calm = stageClock.reducedMotion

  if (props.effect === 'flames') {
    flameColor.set(props.secondary || '#ff8c1a')
    for (const flame of flames) {
      const rise = (elapsed * (calm ? 0.6 : 1.8) + flame.phase) % 1
      flame.sprite.visible = true
      flame.sprite.position.set(flame.side * 2.24, 0.08 + rise * 0.85, 1.5 + flame.slot * 1.15)
      const height = 0.42 + rise * 0.35 + energy * 0.2
      flame.sprite.scale.set(0.26, height, 1)
      flame.material.color.copy(flameColor)
      flame.material.opacity = (0.35 + energy * 0.4) * (1 - rise * 0.35)
    }
  }

  if (props.effect === 'smoke' || props.effect === 'mist') {
    const pool = props.effect === 'smoke' ? smoke : mist
    washColor.set(props.effect === 'smoke' ? '#d7d2dc' : (props.primary || '#d7f7ff'))
    for (const puff of pool) {
      const cycle = ((elapsed * (calm ? 0.08 : 0.16) + puff.phase) % 1)
      const fade = Math.sin(cycle * Math.PI)
      puff.sprite.visible = fade > 0.05
      const spread = props.effect === 'smoke' ? 0.72 : 1.15
      puff.sprite.position.set(
        puff.side * (2.35 + Math.sin(elapsed * 0.3 + puff.phase) * 0.18),
        0.15 + cycle * (props.effect === 'smoke' ? 1.3 : 0.8),
        puff.z,
      )
      puff.sprite.scale.set(spread, spread * 0.7, 1)
      puff.material.color.copy(washColor)
      puff.material.opacity = fade * (props.effect === 'smoke' ? 0.28 : 0.2) * (0.6 + energy)
    }
  }

  if (props.effect === 'disco') {
    const beat = calm ? 0 : Math.floor(elapsed * 1.6)
    for (const lamp of disco) {
      lamp.mesh.visible = true
      const hot = (beat + lamp.index) % 4 === 0
      lamp.material.color.set(discoColors[(beat + lamp.index) % discoColors.length] ?? '#ff2bd6')
      lamp.material.opacity = hot ? 0.55 + energy * 0.35 : 0.16
      const scale = hot ? 1.35 : 0.8
      lamp.mesh.scale.setScalar(scale)
    }
  }

  if (props.effect === 'embers') {
    flameColor.set(props.primary || '#ff7a32')
    for (const ember of embers) {
      const rise = (elapsed * (calm ? 0.25 : 0.7) + ember.phase) % 1
      ember.sprite.visible = true
      ember.sprite.position.set(
        ember.side * (2.15 + rise * 0.35),
        0.12 + rise * 1.5,
        1.2 + (ember.phase % 5) * 1.4,
      )
      ember.sprite.scale.set(0.12, 0.12, 1)
      ember.material.color.copy(flameColor)
      ember.material.opacity = (1 - rise) * (0.35 + energy * 0.4)
    }
  }
})

onBeforeUnmount(() => {
  for (const item of disposables) item.dispose()
})
</script>

<template>
  <primitive :object="group" />
</template>
