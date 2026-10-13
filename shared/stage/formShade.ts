import type { MeshStandardMaterial } from 'three'

const FORM_SHADE = `
float formShade = dot(normalize(normal), normalize(vec3(0.32, 0.86, 0.4)));
outgoingLight *= mix(0.55, 1.22, smoothstep(-0.25, 0.8, formShade));
`

const STAGE_FADE = `
float stageAlong = smoothstep(13.0, 21.0, stageWorld.z);
float stageBoard = 1.0 - smoothstep(2.05, 2.75, abs(stageWorld.x));
gl_FragColor.a *= 1.0 - stageAlong * stageBoard;
`

export function shadeFaces(material: MeshStandardMaterial, fadeTop = false) {
  material.customProgramCacheKey = () => fadeTop ? 'stage-form-shade-fade-mid' : 'stage-form-shade'
  if (fadeTop) {
    material.transparent = true
    material.depthWrite = false
  }
  material.onBeforeCompile = (shader) => {
    if (fadeTop) {
      const declare = '#include <common>\nvarying vec3 stageWorld;'
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', declare)
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\nstageWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        )
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', declare)
    }
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      fadeTop
        ? `${FORM_SHADE}#include <opaque_fragment>\n${STAGE_FADE}`
        : `${FORM_SHADE}#include <opaque_fragment>`,
    )
  }
  return material
}
