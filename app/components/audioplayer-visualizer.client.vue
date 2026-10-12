<script lang="ts" setup>
const viz: Ref<HTMLCanvasElement | null> = ref(null);
let frame = 0;
let generation = 0;

defineExpose({
  init,
});

let audioCtx: AudioContext;
let audioSource: MediaElementAudioSourceNode;
let analyser: AnalyserNode;

async function init(player: HTMLAudioElement) {
  const currentGeneration = ++generation;
  cancelAnimationFrame(frame);
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

  if (audioCtx.state === "suspended") await audioCtx.resume();

  if (currentGeneration !== generation) return;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const vizWidth = viz.value?.width || 0;
  const vizHeight = viz.value?.height || 0;
  const barWidth = 12;
  let barHeight = 0;

  const img = document.createElement("img");
  img.src = "/bar.png";

  function renderFrame() {
    frame = requestAnimationFrame(renderFrame);

    let x = 0;

    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, vizWidth, vizHeight);

    for (let i = 0; i < bufferLength; i++) {
      barHeight = dataArray[i] ?? 0;

      const pattern = ctx.createPattern(img, "repeat") as CanvasPattern;
      if (!pattern) return;
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
onUnmounted(() => {
  generation++;
  cancelAnimationFrame(frame);
  audioSource?.disconnect();
  analyser?.disconnect();
  if (audioCtx && audioCtx.state !== "closed") void audioCtx.close();
});
</script>

<template>
  <canvas ref="viz"/>
</template>
