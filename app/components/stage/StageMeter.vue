<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { useLoop } from '@tresjs/core'
import { BoxGeometry, Color, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D } from 'three'
import { LANE_COLORS, stageClock } from '#shared/stage/clock'
import { TRUSS_Y, TRUSS_Z } from '#shared/stage/set'
import { shadeFaces } from '#shared/stage/formShade'

// The crowd meter: twelve voxel blocks hanging under the truss. Dark when the
// room is quiet; phone taps light it up through the fret colours. During an
// encore vote it fills in gold with the share of the room that joined in.
const BLOCKS = 12
const SIZE = 0.78
const GAP = 0.14
// Low enough to sit fully in frame, over the top edge of the LED wall.
const Y = TRUSS_Y - 2.6
const Z = TRUSS_Z - 0.9
const WIDTH = BLOCKS * SIZE + (BLOCKS - 1) * GAP

const group = new Group()
const frameGeo = new BoxGeometry(WIDTH + 0.5, SIZE + 0.45, 0.4)
const frameMat = shadeFaces(new MeshStandardMaterial({ color: '#1a1430', roughness: 0.8, fog: false }))
const frame = new Mesh(frameGeo, frameMat)
frame.position.set(0, Y, Z + 0.2)
group.add(frame)
// Two chains up to the truss.
const chainGeo = new BoxGeometry(0.08, TRUSS_Y - Y - 0.35, 0.08)
for (const x of [-WIDTH / 2 + 0.6, WIDTH / 2 - 0.6]) {
  const chain = new Mesh(chainGeo, frameMat)
  chain.position.set(x, (TRUSS_Y + Y) / 2, Z + 0.2)
  group.add(chain)
}

// Unlit blocks so lit ones glow in the bloom; dark ones stay near black.
const blockGeo = new BoxGeometry(SIZE, SIZE, SIZE * 0.6)
const blockMat = new MeshBasicMaterial({ toneMapped: false, fog: false })
const blocks = new InstancedMesh(blockGeo, blockMat, BLOCKS)
const dummy = new Object3D()
for (let i = 0; i < BLOCKS; i++) {
  dummy.position.set(-WIDTH / 2 + SIZE / 2 + i * (SIZE + GAP), Y, Z)
  // The camera looks from the audience side, so the bar fills left to right on screen.
  dummy.position.x *= -1
  dummy.updateMatrix()
  blocks.setMatrixAt(i, dummy.matrix)
}
group.add(blocks)

const dark = new Color('#241c36')
const gold = new Color('#ffc531')
const lit = LANE_COLORS.map(color => new Color(color))
const color = new Color()
let shown = 0

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  // Ease toward the live level so taps fill smoothly and a full meter drains.
  shown += (stageClock.meter - shown) * Math.min(1, delta * 6)
  const filled = shown * BLOCKS
  const encore = stageClock.meterMode === 'encore'
  for (let i = 0; i < BLOCKS; i++) {
    const amount = Math.min(1, Math.max(0, filled - i))
    const on = encore ? gold : lit[Math.floor(i / 2) % lit.length]!
    color.copy(dark).lerp(on, amount)
    blocks.setColorAt(i, color)
  }
  if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true
})

onBeforeUnmount(() => {
  frameGeo.dispose()
  frameMat.dispose()
  chainGeo.dispose()
  blockGeo.dispose()
  blockMat.dispose()
})
</script>

<template>
  <primitive :object="group" />
</template>
