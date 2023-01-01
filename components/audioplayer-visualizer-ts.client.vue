<script lang="ts" setup>
import type { Ref } from "vue";

await nextTick();
const instance = getCurrentInstance();

const player = instance?.parent?.refs["player"] as HTMLAudioElement;
const viz: Ref<HTMLCanvasElement | null> = ref(null);
const ctx = viz.value?.getContext("2d") as CanvasRenderingContext2D;

let vizWidth: number = 0;
let vizHeight: number = 0;

if (viz.value) {
  viz.value.width = window.innerWidth;
  viz.value.height = window.innerHeight;
  vizWidth = viz.value.width;
  vizHeight = viz.value.height;
}

const audioCtx = new window.AudioContext();
const audioSource = audioCtx.createMediaElementSource(player);
const analyser = audioCtx.createAnalyser();

audioSource.connect(analyser);
analyser.connect(audioCtx.destination);
analyser.fftSize = 128;

const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);
const barWidth = viz.value ? viz.value.width : 0 / bufferLength;

let x = 0;

function animate() {
  x = 0;
  ctx.clearRect(0, 0, vizWidth, vizHeight);
  analyser.getByteFrequencyData(dataArray);
  for (let i = 0; i < bufferLength; i++) {
    const barHeight = dataArray[i];
    ctx.fillStyle = "white";
    ctx.fillRect(x, vizHeight - barHeight, barWidth, barHeight);
    x += barWidth;
  }

  requestAnimationFrame(animate);
}

animate();
</script>

<template>
  <div class="audioplayer-visualizer">
    <canvas class="w-screen h-screen" ref="viz"></canvas>
  </div>
</template>
