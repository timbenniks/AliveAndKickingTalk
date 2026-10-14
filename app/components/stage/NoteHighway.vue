<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useLoop } from '@tresjs/core'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { BOARD_TILT, frameDecay, HIGHWAY_SPEED, LANE_COLORS, LANE_X, stageClock } from '#shared/stage/clock'
import { shadeFaces } from '#shared/stage/formShade'

// Visualizer only: pulses come from stageClock.events, fed by the song, the
// guitar input or a MIDI pickup. There are no authored notes.
const props = defineProps<{
  resetKey: string
  gems?: string[]
}>()

function laneColor(lane: number) {
  return props.gems?.[lane] || LANE_COLORS[lane] || '#ffffff'
}

type Pulse = { at: number, lane: number, strength: number, span: number }
const pulses: Pulse[] = []

const group = new Group()
group.rotation.x = BOARD_TILT
group.renderOrder = 4
const materials: Array<{ dispose: () => void }> = []

function shadeMerged(blocks: BoxGeometry[]) {
  const merged = mergeGeometries(blocks)
  for (const block of blocks) block.dispose()
  if (!merged) throw new Error('voxel merge failed')
  const position = merged.getAttribute('position')
  const normal = merged.getAttribute('normal')
  const shade = new Float32Array(position.count * 3)
  const point = new Vector3()
  const face = new Vector3()
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i)
    face.fromBufferAttribute(normal, i)
    const inward = face.dot(point) < -0.02
    let tone = 0.32 + Math.max(0, face.y) * 0.62 + Math.max(0, face.z) * 0.08
    if (face.y < -0.45) tone = 0.18
    if (inward) tone *= 0.5
    shade[i * 3] = tone
    shade[i * 3 + 1] = tone
    shade[i * 3 + 2] = tone
  }
  merged.setAttribute('color', new BufferAttribute(shade, 3))
  return merged
}

function voxelOrb() {
  const cell = 0.11
  const blocks: BoxGeometry[] = []
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (Math.abs(x) + Math.abs(y) + Math.abs(z) > 2) continue
        const block = new BoxGeometry(cell * 0.92, cell * 0.92, cell * 0.92)
        block.translate(x * cell, y * cell, z * cell)
        blocks.push(block)
      }
    }
  }
  return shadeMerged(blocks)
}

function voxelRing() {
  const blocks: BoxGeometry[] = []
  const count = 16
  const radius = 0.26
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    const block = new BoxGeometry(0.1, 0.08, 0.1)
    block.translate(Math.cos(angle) * radius, 0.04, Math.sin(angle) * radius)
    blocks.push(block)
  }
  return shadeMerged(blocks)
}

function voxelCap() {
  const blocks: BoxGeometry[] = []
  const cell = 0.06
  for (let x = -1; x <= 1; x++) {
    for (let y = 0; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (Math.abs(x) + Math.abs(z) > 1) continue
        const block = new BoxGeometry(cell * 0.88, 0.045, cell * 0.88)
        block.translate(x * cell, 0.03 + y * 0.04, z * cell)
        blocks.push(block)
      }
    }
  }
  return shadeMerged(blocks)
}

function voxelTrail() {
  const blocks: BoxGeometry[] = []
  const count = 7
  const step = 1 / count
  for (let i = 0; i < count; i++) {
    const block = new BoxGeometry(0.12, 0.08, step * 0.7)
    block.translate(0, 0.04, -0.5 + (i + 0.5) * step)
    blocks.push(block)
  }
  return shadeMerged(blocks)
}

function pixelStamp(draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.imageSmoothingEnabled = false
    draw(ctx)
  }
  const texture = new CanvasTexture(canvas)
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  materials.push(texture)
  return texture
}

const gemGeo = voxelOrb()
const trailGeo = voxelTrail()
const capMap = pixelStamp((ctx) => {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dist = Math.hypot(x - 7.5, y - 7.5)
      if (dist > 5.2) continue
      ctx.fillStyle = dist > 3.4 ? '#ffffff' : dist > 2 ? '#9a9a9a' : '#5a5a5a'
      ctx.fillRect(x, y, 1, 1)
    }
  }
})
const ringGeo = voxelRing()
const capGeo = voxelCap()
const POOL = 24

function paintMaterial(color: string, intensity: number) {
  const material = new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.82,
    metalness: 0,
  })
  shadeFaces(material)
  materials.push(material)
  return material
}

function laneMaterials(intensity: number, roughness: number) {
  return LANE_X.map((_, lane) => {
    const material = paintMaterial(laneColor(lane), intensity)
    material.vertexColors = true
    material.roughness = roughness
    return material
  })
}

const gemMaterials = laneMaterials(0.3, 0.42)
const trailMaterials = laneMaterials(0.12, 0.5)

function pooled(geometry: BufferGeometry, material: MeshStandardMaterial) {
  const mesh = new InstancedMesh(geometry, material, POOL)
  mesh.count = 0
  mesh.frustumCulled = false
  group.add(mesh)
  return mesh
}

const gemMeshes = gemMaterials.map(material => pooled(gemGeo, material))
const trailMeshes = trailMaterials.map(material => pooled(trailGeo, material))
const haloGeo = new BoxGeometry(0.3, 0.02, 0.3)
const haloMaterial = new MeshBasicMaterial({
  color: '#12080c',
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
})
materials.push(haloMaterial)
const haloMesh = new InstancedMesh(haloGeo, haloMaterial, POOL * LANE_X.length)
haloMesh.count = 0
haloMesh.frustumCulled = false
group.add(haloMesh)

const dummy = new Object3D()
const gemCursor = Array.from({ length: LANE_X.length }, () => 0)
const trailCursor = Array.from({ length: LANE_X.length }, () => 0)
let haloCursor = 0

function stamp(mesh: InstancedMesh, index: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  dummy.position.set(x, y, z)
  dummy.scale.set(sx, sy, sz)
  dummy.rotation.set(0, 0, 0)
  dummy.updateMatrix()
  mesh.setMatrixAt(index, dummy.matrix)
}

function placeGem(lane: number, x: number, y: number, z: number, scale: number) {
  const cursor = gemCursor[lane] ?? 0
  const mesh = gemMeshes[lane]
  if (!mesh || cursor >= POOL) return false
  gemCursor[lane] = cursor + 1
  stamp(mesh, cursor, x, y, z, scale, scale, scale)
  return true
}

function placeTrail(lane: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  const cursor = trailCursor[lane] ?? 0
  const mesh = trailMeshes[lane]
  if (!mesh || cursor >= POOL) return
  trailCursor[lane] = cursor + 1
  stamp(mesh, cursor, x, y, z, sx, sy, sz)
}

function placeHalo(x: number, z: number, scaleX: number, scaleZ: number) {
  if (haloCursor >= haloMesh.instanceMatrix.count) return
  stamp(haloMesh, haloCursor, x, 0.08, z, scaleX, 1, scaleZ)
  haloCursor += 1
}

function commitHighway() {
  for (let lane = 0; lane < LANE_X.length; lane++) {
    const gems = gemMeshes[lane]!
    const trails = trailMeshes[lane]!
    gems.count = gemCursor[lane] ?? 0
    trails.count = trailCursor[lane] ?? 0
    if (gems.count > 0) gems.instanceMatrix.needsUpdate = true
    if (trails.count > 0) trails.instanceMatrix.needsUpdate = true
  }
  haloMesh.count = haloCursor
  if (haloCursor > 0) haloMesh.instanceMatrix.needsUpdate = true
  gemCursor.fill(0)
  trailCursor.fill(0)
  haloCursor = 0
}

const flashLevel = Array.from({ length: LANE_X.length }, () => 0)
const frets = LANE_X.map((x, lane) => {
  const color = laneColor(lane)
  const ringMat = paintMaterial(color, 0.22)
  ringMat.vertexColors = true
  ringMat.roughness = 0.46
  const mesh = new Mesh(ringGeo, ringMat)
  mesh.position.set(x, 0.05, 1.15)
  group.add(mesh)
  const capMat = paintMaterial(color, 0.28)
  capMat.vertexColors = true
  capMat.roughness = 0.42
  const cap = new Mesh(capGeo, capMat)
  cap.position.set(x, 0.07, 1.15)
  group.add(cap)
  return { mesh, cap }
})
const fretGlowGeo = new PlaneGeometry(0.78, 0.78)
fretGlowGeo.rotateX(Math.PI / 2)
const fretGlows = LANE_X.map((x, lane) => {
  const material = new MeshBasicMaterial({
    color: laneColor(lane),
    map: capMap,
    transparent: true,
    opacity: 0.18,
    alphaTest: 0.4,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  materials.push(material)
  const mesh = new Mesh(fretGlowGeo, material)
  mesh.position.set(x, 0.07, 1.15)
  group.add(mesh)
  return mesh
})
const SPARK_COUNT = 72
type Spark = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  age: number
  r: number
  g: number
  b: number
  alive: boolean
}
const sparks: Spark[] = Array.from({ length: SPARK_COUNT }, () => ({
  x: 0, y: -8, z: 0, vx: 0, vy: 0, vz: 0, life: 1, age: 1, r: 1, g: 1, b: 1, alive: false,
}))
const sparkGeo = new BufferGeometry()
const sparkPositions = new Float32Array(SPARK_COUNT * 3)
const sparkColors = new Float32Array(SPARK_COUNT * 3)
sparkGeo.setAttribute('position', new BufferAttribute(sparkPositions, 3))
sparkGeo.setAttribute('color', new BufferAttribute(sparkColors, 3))
const sparkCanvas = document.createElement('canvas')
sparkCanvas.width = 8
sparkCanvas.height = 8
const sparkCtx = sparkCanvas.getContext('2d')
if (sparkCtx) {
  sparkCtx.fillStyle = '#ffffff'
  sparkCtx.fillRect(2, 2, 4, 4)
}
const sparkTexture = new CanvasTexture(sparkCanvas)
sparkTexture.magFilter = NearestFilter
sparkTexture.minFilter = NearestFilter
sparkTexture.generateMipmaps = false
sparkTexture.needsUpdate = true
const sparkMat = new PointsMaterial({
  size: 0.14,
  map: sparkTexture,
  vertexColors: true,
  transparent: true,
  opacity: 0.95,
  blending: AdditiveBlending,
  depthWrite: false,
})
materials.push(sparkMat)
const sparkPoints = new Points(sparkGeo, sparkMat)
sparkPoints.frustumCulled = false
group.add(sparkPoints)
const sparkColor = new Color()

const SMOKE_COUNT = 70
type Puff = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  age: number
  r: number
  g: number
  b: number
  alive: boolean
}
const puffs: Puff[] = Array.from({ length: SMOKE_COUNT }, () => ({
  x: 0, y: -8, z: 0, vx: 0, vy: 0, vz: 0, life: 1, age: 1, r: 0.7, g: 0.7, b: 0.7, alive: false,
}))
const smokeCanvas = document.createElement('canvas')
smokeCanvas.width = 32
smokeCanvas.height = 32
const smokeCtx = smokeCanvas.getContext('2d')
if (smokeCtx) {
  const haze = smokeCtx.createRadialGradient(16, 16, 2, 16, 16, 16)
  haze.addColorStop(0, 'rgba(255,255,255,1)')
  haze.addColorStop(0.28, 'rgba(255,255,255,0.72)')
  haze.addColorStop(0.62, 'rgba(255,255,255,0.22)')
  haze.addColorStop(1, 'rgba(255,255,255,0)')
  smokeCtx.fillStyle = haze
  smokeCtx.fillRect(0, 0, 32, 32)
}
const smokeTexture = new CanvasTexture(smokeCanvas)
smokeTexture.needsUpdate = true
materials.push(smokeTexture)
const smokeGeo = new BufferGeometry()
const smokePositions = new Float32Array(SMOKE_COUNT * 3)
const smokeColors = new Float32Array(SMOKE_COUNT * 3)
smokeGeo.setAttribute('position', new BufferAttribute(smokePositions, 3))
smokeGeo.setAttribute('color', new BufferAttribute(smokeColors, 3))
const smokeMat = new PointsMaterial({
  size: 0.62,
  map: smokeTexture,
  vertexColors: true,
  transparent: true,
  opacity: 0.42,
  blending: AdditiveBlending,
  depthWrite: false,
  depthTest: false,
})
materials.push(smokeMat)
const smokePoints = new Points(smokeGeo, smokeMat)
smokePoints.frustumCulled = false
smokePoints.renderOrder = 5
group.add(smokePoints)
const smokeColor = new Color()
const gemSpots: Array<{ x: number, y: number, z: number, lane: number }> = []

function emitSmoke(x: number, y: number, z: number, lane: number) {
  smokeColor.set(laneColor(lane))
  const puff = puffs.find(item => !item.alive)
  if (!puff) return
  puff.alive = true
  puff.age = 0
  puff.life = 1.3 + Math.random() * 1.1
  puff.x = x + (Math.random() - 0.5) * 0.08
  puff.y = y + 0.12
  puff.z = z + (Math.random() - 0.5) * 0.06
  puff.vx = (Math.random() - 0.5) * 0.08
  puff.vy = 0.16 + Math.random() * 0.2
  puff.vz = (Math.random() - 0.5) * 0.06
  puff.r = smokeColor.r * 0.22 + 0.12
  puff.g = smokeColor.g * 0.22 + 0.12
  puff.b = smokeColor.b * 0.22 + 0.12
}

function emitSparks(lane: number) {
  if (stageClock.reducedMotion) return
  sparkColor.set(laneColor(lane))
  let left = 8
  for (const spark of sparks) {
    if (spark.alive) continue
    spark.alive = true
    spark.age = 0
    spark.life = 0.55 + Math.random() * 0.35
    spark.x = (LANE_X[lane] ?? 0) + (Math.random() - 0.5) * 0.22
    spark.y = 0.28
    spark.z = 1.2
    spark.vx = (Math.random() - 0.5) * 1.4
    spark.vy = 0.7 + Math.random() * 1.6
    spark.vz = 9 + Math.random() * 6
    spark.r = sparkColor.r
    spark.g = sparkColor.g
    spark.b = sparkColor.b
    left -= 1
    if (left <= 0) break
  }
}

let previous = 0
let lookKey = ''
let smokeDrawn = false

function syncLook() {
  const key = LANE_X.map((_, lane) => laneColor(lane)).join('|')
  if (key === lookKey) return
  lookKey = key
  const gemIntensity = 0.75
  const trailIntensity = 0.4
  for (let lane = 0; lane < LANE_X.length; lane++) {
    const color = laneColor(lane)
    const gem = gemMaterials[lane]!
    gem.color.set(color)
    gem.emissive.set(color)
    gem.emissiveIntensity = gemIntensity
    const trail = trailMaterials[lane]!
    trail.color.set(color)
    trail.emissive.set(color)
    trail.emissiveIntensity = trailIntensity
    const fret = frets[lane]
    if (fret) {
      const ring = fret.mesh.material as MeshStandardMaterial
      const center = fret.cap.material as MeshStandardMaterial
      ring.color.set(color)
      ring.emissive.set(color)
      center.color.set(color)
      center.emissive.set(color)
    }
    const glow = fretGlows[lane]
    if (glow) (glow.material as MeshBasicMaterial).color.set(color)
  }
}

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta: renderDelta }) => {
  syncLook()
  const time = stageClock.flow
  const delta = time - previous
  const continuous = delta >= 0 && delta < 0.25
  gemSpots.length = 0
  if (stageClock.pulsing && stageClock.analysis === 'live' && continuous && !stageClock.reducedMotion) {
    for (const { lane, strength } of stageClock.events) {
      if (lane < 0 || lane >= LANE_X.length) continue
      pulses.push({ at: time, lane, strength: strength || 0.4, span: 0.06 })
      if (flashLevel[lane] !== undefined) flashLevel[lane] = 1
      emitSparks(lane)
    }
  }
  stageClock.events.length = 0
  {
    const visibleUntil = time - 16 / HIGHWAY_SPEED
    let kept = 0
    for (let i = 0; i < pulses.length; i++) {
      if (pulses[i]!.at >= visibleUntil) pulses[kept++] = pulses[i]!
    }
    pulses.length = kept
    if (stageClock.pulsing && continuous) {
      const latest = Array.from({ length: LANE_X.length }, () => -1)
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pulse = pulses[i]!
        if (latest[pulse.lane] === -1) latest[pulse.lane] = i
      }
      for (let lane = 0; lane < LANE_X.length; lane++) {
        const index = latest[lane] ?? -1
        const pulse = pulses[index]
        if (!pulse) continue
        if ((stageClock.lanes[lane] ?? 0) > 0.34) pulse.span = Math.min(0.42, pulse.span + delta * 0.65)
      }
    }
    for (const pulse of pulses) {
      const z = (time - pulse.at) * HIGHWAY_SPEED
      if (z < 0.55 || z > 16) continue
      const x = LANE_X[pulse.lane] ?? 0
      const scale = 0.62 + Math.min(0.4, pulse.strength)
      if (placeGem(pulse.lane, x, 0.22, z, scale)) {
        gemSpots.push({ x, y: 0.22, z, lane: pulse.lane })
        placeHalo(x, z, scale, scale)
      }
      if (!stageClock.reducedMotion) {
        let length = Math.min(3.6, 0.35 + pulse.span * 8)
        if (z - length < 0.4) length = Math.max(0.28, z - 0.4)
        placeTrail(pulse.lane, x, 0.065, z - length / 2, 0.55, 0.7, length)
      }
    }
  }
  commitHighway()
  frets.forEach(({ mesh, cap }, lane) => {
    const level = flashLevel[lane] ?? 0
    const ring = mesh.material as MeshStandardMaterial
    const center = cap.material as MeshStandardMaterial
    ring.emissiveIntensity = 0.22 + level * 1.8
    center.emissiveIntensity = 0.28 + level * 2.2
    const scale = 1 + level * 0.16
    mesh.scale.set(scale, 1, scale)
    cap.scale.set(scale, 1, scale)
    flashLevel[lane] = level * frameDecay(0.84, renderDelta)
    const glow = fretGlows[lane]
    if (glow) {
      const mat = glow.material as MeshBasicMaterial
      mat.opacity = 0.12 + level * 0.85
      glow.scale.setScalar(1 + level * 0.6)
    }
  })
  const step = continuous ? delta : 0
  for (let i = 0; i < sparks.length; i++) {
    const spark = sparks[i]!
    if (spark.alive && step > 0) {
      spark.age += step
      spark.x += spark.vx * step
      spark.y += spark.vy * step
      spark.z += spark.vz * step
      spark.vy -= step * 2.2
      if (spark.age >= spark.life) spark.alive = false
    }
    const fade = spark.alive ? 1 - spark.age / spark.life : 0
    sparkPositions[i * 3] = spark.alive ? spark.x : 0
    sparkPositions[i * 3 + 1] = spark.alive ? spark.y : -8
    sparkPositions[i * 3 + 2] = spark.alive ? spark.z : 0
    sparkColors[i * 3] = spark.r * fade
    sparkColors[i * 3 + 1] = spark.g * fade
    sparkColors[i * 3 + 2] = spark.b * fade
  }
  sparkGeo.attributes.position!.needsUpdate = true
  sparkGeo.attributes.color!.needsUpdate = true
  if (step > 0 && !stageClock.reducedMotion) {
    for (const spot of gemSpots) {
      if (Math.random() < step * 1.2) emitSmoke(spot.x, spot.y, spot.z, spot.lane)
    }
  }
  let smokeLive = false
  for (let i = 0; i < puffs.length; i++) {
    const puff = puffs[i]!
    if (!puff.alive) continue
    if (step > 0) {
      puff.age += step
      puff.x += puff.vx * step
      puff.y += puff.vy * step
      puff.z += puff.vz * step
      puff.vy += step * 0.15
      if (puff.age >= puff.life) puff.alive = false
    }
    const fade = puff.alive ? Math.sin((puff.age / puff.life) * Math.PI) : 0
    if (fade > 0.04) smokeLive = true
    smokePositions[i * 3] = fade > 0.04 ? puff.x : 0
    smokePositions[i * 3 + 1] = fade > 0.04 ? puff.y : -8
    smokePositions[i * 3 + 2] = fade > 0.04 ? puff.z : 0
    smokeColors[i * 3] = fade > 0.04 ? puff.r * fade : 0
    smokeColors[i * 3 + 1] = fade > 0.04 ? puff.g * fade : 0
    smokeColors[i * 3 + 2] = fade > 0.04 ? puff.b * fade : 0
  }
  if (smokeLive || smokeDrawn) {
    smokeGeo.attributes.position!.needsUpdate = true
    smokeGeo.attributes.color!.needsUpdate = true
  }
  smokeDrawn = smokeLive
  previous = time
})

function clearPulses() {
  pulses.length = 0
  stageClock.events.length = 0
  previous = stageClock.flow
}

watch(() => props.resetKey, clearPulses)

onBeforeUnmount(() => {
  gemGeo.dispose()
  ringGeo.dispose()
  capGeo.dispose()
  haloGeo.dispose()
  trailGeo.dispose()
  fretGlowGeo.dispose()
  sparkGeo.dispose()
  sparkTexture.dispose()
  smokeGeo.dispose()
  for (const material of materials) material.dispose()
})
</script>

<template>
  <primitive :object="group" />
</template>
