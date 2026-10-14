<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useLoop } from '@tresjs/core'
import { AdditiveBlending, Color, CylinderGeometry, DoubleSide, Group, Mesh, Quaternion, ShaderMaterial, Vector3 } from 'three'
import { advanceSolo, stageClock } from '#shared/stage/clock'
import { CANS, TRUSS_Y, TRUSS_Z } from '#shared/stage/set'

// Volumetric beams from the truss cans, only while a solo plays. Soft cones
// that fade along their length and at their edges, sweeping slowly. They stay
// faint so the fretboard keeps the light.
const props = defineProps<{ solo: boolean, primary: string, secondary: string, rich: boolean }>()

const LENGTH = 24
const STRENGTH = 0.3
// Low quality keeps every other can.
const cans = props.rich ? CANS : CANS.filter((_, i) => i % 2 === 0)

const geometry = new CylinderGeometry(0.18, 2.6, LENGTH, 24, 1, true)
geometry.translate(0, -LENGTH / 2, 0)

const vertexShader = `
varying float vAlong;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
  vAlong = -position.y / ${LENGTH.toFixed(1)};
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vNormalView = normalize(normalMatrix * normal);
  vViewDir = normalize(-view.xyz);
  gl_Position = projectionMatrix * view;
}`
const fragmentShader = `
uniform vec3 color;
uniform float strength;
varying float vAlong;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
  // Clamp before pow(): a negative base is NaN on real GPUs (Metal), and the
  // bloom pass spreads NaN pixels until the whole stage renders black.
  float a = clamp(vAlong, 0.0, 1.0);
  float edge = pow(clamp(abs(dot(vNormalView, vViewDir)), 0.0, 1.0), 1.6);
  float along = pow(1.0 - a, 1.15) * smoothstep(0.0, 0.04, a);
  gl_FragColor = vec4(color * edge * along * strength, 1.0);
}`

const group = new Group()
group.visible = false
const down = new Vector3(0, -1, 0)
const aim = new Vector3()
const turn = new Quaternion()
const beams = cans.map((x, i) => {
  const material = new ShaderMaterial({
    uniforms: { color: { value: new Color() }, strength: { value: 0 } },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
  })
  const mesh = new Mesh(geometry, material)
  mesh.position.set(x, TRUSS_Y - 0.95, TRUSS_Z - 0.5)
  mesh.renderOrder = 3
  group.add(mesh)
  // Aim down at the stage, splayed so the beams cross over the highway.
  return { mesh, material, x, primary: i % 2 === 0 }
})

function paint() {
  for (const beam of beams) beam.material.uniforms.color!.value.set(beam.primary ? props.primary : props.secondary)
}
paint()
watch(() => [props.primary, props.secondary], paint)

let level = 0
let clock = 0
const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  const dt = Math.min(delta, 0.05)
  level = advanceSolo(level, props.solo, delta)
  const focus = level * level * (3 - 2 * level)
  group.visible = level > 0.001
  if (!group.visible) return
  if (stageClock.playing && !stageClock.reducedMotion) clock += dt
  const sweep = Math.sin(clock * 0.45)
  for (const beam of beams) {
    // One slow fan sweep, rather than every can wandering independently.
    aim.set(-beam.x * 0.55 + sweep * 1.5, -(TRUSS_Y - 1.5), -(TRUSS_Z - 9) + Math.cos(clock * 0.3) * 0.8).normalize()
    turn.setFromUnitVectors(down, aim)
    beam.mesh.quaternion.copy(turn)
    beam.material.uniforms.strength!.value = focus * STRENGTH
  }
})

onBeforeUnmount(() => {
  geometry.dispose()
  for (const beam of beams) beam.material.dispose()
})
</script>

<template>
  <primitive :object="group" />
</template>
