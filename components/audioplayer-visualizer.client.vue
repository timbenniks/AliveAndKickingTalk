<script setup>
const viz = ref(null);
const instance = getCurrentInstance();

onMounted(async () => {
  await nextTick();
  init();
});

function init() {
  const player = instance?.parent?.refs["player"];
  const ctx = viz.value?.getContext("2d");

  viz.value.width = window.innerWidth;
  viz.value.height = window.innerHeight;

  const audioCtx = new window.AudioContext();
  const audioSource = audioCtx.createMediaElementSource(player);
  const analyser = audioCtx.createAnalyser();

  audioSource.connect(analyser);
  analyser.connect(audioCtx.destination);
  analyser.fftSize = 256;

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const WIDTH = viz.value.width;
  const HEIGHT = viz.value.height;
  const barWidth = 12;
  let barHeight = 0;
  const img = document.createElement("img");
  img.src = "/bar.png";

  function renderFrame() {
    requestAnimationFrame(renderFrame);

    let x = 0;

    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    for (let i = 0; i < bufferLength; i++) {
      barHeight = dataArray[i];

      const pattern = ctx.createPattern(img, "repeat");
      ctx.fillStyle = pattern;
      ctx.fillRect(
        x,
        Math.ceil((HEIGHT - barHeight) / 12) * 12,
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
  <div class="audioplayer-visualizer">
    <canvas class="w-screen h-screen" ref="viz"></canvas>
  </div>
</template>
