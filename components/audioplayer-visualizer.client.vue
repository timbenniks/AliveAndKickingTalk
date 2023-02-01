<script lang="ts" setup>
import type { Ref } from "vue";

const viz: Ref<HTMLCanvasElement | null> = ref(null);
const instance = getCurrentInstance();

defineExpose({
  init,
});

let audioCtx: AudioContext;
let audioSource: MediaElementAudioSourceNode;
let analyser: AnalyserNode;

function init() {
  const player = instance?.parent?.refs["player"] as HTMLAudioElement;
  const ctx = viz.value?.getContext("2d") as CanvasRenderingContext2D;

  if (viz.value) {
    viz.value.width = window.innerWidth;
    viz.value.height = window.innerHeight;
  }

  if (!audioCtx) {
    audioCtx = new window.AudioContext();
    audioSource = audioCtx.createMediaElementSource(player);
    analyser = audioCtx.createAnalyser();
    audioSource.connect(analyser);
    analyser.connect(audioCtx.destination);
    analyser.fftSize = 512;
  }

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const vizWidth = viz.value?.width || 0;
  const vizHeight = viz.value?.height || 0;
  const barWidth = 12;
  let barHeight = 0;

  const img = document.createElement("img");
  img.src = "/bar.png";

  function renderFrame() {
    requestAnimationFrame(renderFrame);

    let x = 0;

    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, vizWidth, vizHeight);

    for (let i = 0; i < bufferLength; i++) {
      barHeight = dataArray[i];

      const pattern = ctx.createPattern(img, "repeat") as CanvasPattern;
      ctx.fillStyle = pattern;

      ctx.fillRect(
        x,
        Math.ceil((vizHeight - barHeight) / 12) * 12,
        barWidth,
        barHeight
      );

      x += barWidth + 2;
    }
  }

  renderFrame();
}
</script>

<template>
  <canvas ref="viz"></canvas>
</template>
