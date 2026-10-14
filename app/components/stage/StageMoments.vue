<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { useLoop } from '@tresjs/core'
import { BoxGeometry, Color, DynamicDrawUsage, InstancedMesh, MeshBasicMaterial, Object3D } from 'three'
import { LANE_COLORS, stageClock } from '#shared/stage/clock'
import { onMoment } from '#shared/stage/moments'

// Show moments: voxel pyro beside the highway and a confetti finale, fired
// through the moment bus.

const COUNT = 420
const PYRO = ['#fff3c4', '#ffc531', '#ff8c1a', '#ff2d2d']

type Bit = {
  alive: boolean, age: number, life: number, size: number, gravity: number, drag: number,
  x: number, y: number, z: number, vx: number, vy: number, vz: number, spin: number
}
const bits: Bit[] = Array.from({ length: COUNT }, () => ({
  alive: false, age: 0, life: 1, size: 0.1, gravity: 0, drag: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0,
}))

const geometry = new BoxGeometry(1, 1, 1)
// Unlit and untoned so the colors land above the bloom threshold.
const material = new MeshBasicMaterial({ toneMapped: false })
const mesh = new InstancedMesh(geometry, material, COUNT)
mesh.instanceMatrix.setUsage(DynamicDrawUsage)
mesh.frustumCulled = false
mesh.renderOrder = 6
const color = new Color()
const dummy = new Object3D()
for (let i = 0; i < COUNT; i++) {
  dummy.scale.setScalar(0)
  dummy.updateMatrix()
  mesh.setMatrixAt(i, dummy.matrix)
  mesh.setColorAt(i, color.set('#000000'))
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)

function spawn(count: number, init: (bit: Bit, index: number) => string) {
  let made = 0
  bits.forEach((bit, index) => {
    if (made >= count || bit.alive) return
    bit.alive = true
    bit.age = 0
    mesh.setColorAt(index, color.set(init(bit, made)))
    made += 1
  })
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}

function pyro() {
  for (const side of [-1, 1]) {
    spawn(80, (bit) => {
      bit.x = side * rand(2.35, 2.75)
      bit.y = rand(0, 0.2)
      bit.z = rand(2.4, 3.4)
      bit.vx = rand(-0.5, 0.5) - side * 0.2
      bit.vy = rand(4.2, 7.2)
      bit.vz = rand(-0.4, 0.6)
      bit.gravity = 7
      bit.drag = 0.6
      bit.life = rand(0.8, 1.5)
      bit.size = rand(0.07, 0.15)
      bit.spin = rand(-4, 4)
      return PYRO[Math.floor(Math.random() * PYRO.length)]!
    })
  }
}

function confetti() {
  spawn(260, (bit) => {
    bit.x = rand(-4.5, 4.5)
    bit.y = rand(3.6, 6.5)
    bit.z = rand(2, 9)
    bit.vx = rand(-0.3, 0.3)
    bit.vy = rand(-1.4, -0.6)
    bit.vz = rand(-0.2, 0.2)
    bit.gravity = 0.35
    bit.drag = 0.9
    bit.life = rand(3.5, 5.5)
    bit.size = rand(0.07, 0.12)
    bit.spin = rand(-6, 6)
    return LANE_COLORS[Math.floor(Math.random() * LANE_COLORS.length)]!
  })
}

const stopMoments = onMoment((moment) => {
  if (stageClock.reducedMotion) return
  if (moment.kind === 'pyro') pyro()
  else if (moment.kind === 'confetti') confetti()
})

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  const dt = Math.min(delta, 0.05)
  let any = false
  bits.forEach((bit, index) => {
    if (!bit.alive) return
    any = true
    bit.age += dt
    if (bit.age >= bit.life) {
      bit.alive = false
      dummy.scale.setScalar(0)
    } else {
      bit.vy -= bit.gravity * dt
      const keep = 1 - bit.drag * dt
      bit.vx *= keep
      bit.vz *= keep
      // Confetti flutters side to side as it falls.
      const flutter = bit.gravity < 1 ? Math.sin(bit.age * 5 + index) * 0.6 : 0
      bit.x += (bit.vx + flutter) * dt
      bit.y += bit.vy * dt
      bit.z += bit.vz * dt
      const fade = 1 - Math.pow(bit.age / bit.life, 3)
      dummy.position.set(bit.x, bit.y, bit.z)
      dummy.rotation.set(bit.age * bit.spin, bit.age * bit.spin * 0.7, 0)
      dummy.scale.set(bit.size * fade, bit.size * fade, (bit.gravity < 1 ? 0.35 : 1) * bit.size * fade)
    }
    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)
  })
  if (any) mesh.instanceMatrix.needsUpdate = true
})

onBeforeUnmount(() => {
  stopMoments()
  geometry.dispose()
  material.dispose()
})
</script>

<template>
  <primitive :object="mesh" />
</template>
