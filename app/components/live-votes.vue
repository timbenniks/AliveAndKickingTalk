<script setup lang="ts">
import type { Vote } from "../types";

import { storeToRefs } from "pinia";
const songStore = useSongStore();
const { theLatestVotes: votes } = storeToRefs(songStore);

// New votes bounce across the screen as 16x16 pixel faces with a hard shadow,
// the same faces as the mosh pit on the song screen.
type Face = { face: HTMLCanvasElement; radius: number; x: number; y: number; dx: number; dy: number; vel: number };

const SIZE = 48;
const SHADOW = 4;
const votez: Ref<HTMLCanvasElement | null> = ref(null);

const width = ref(window.innerWidth);
const height = ref(window.innerHeight - 80);

let frame = 0;
let timer: ReturnType<typeof setInterval>;
onUnmounted(() => { cancelAnimationFrame(frame); clearInterval(timer); });

function fallbackFace(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#2c2348";
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = "#a99fbb";
  ctx.fillRect(4, 3, 8, 8);
  ctx.fillRect(2, 12, 12, 4);
  ctx.fillStyle = "#14080c";
  ctx.fillRect(6, 6, 1, 2);
  ctx.fillRect(9, 6, 1, 2);
}

function pixelFace(src: string) {
  const face = document.createElement("canvas");
  face.width = face.height = 16;
  const ctx = face.getContext("2d") as CanvasRenderingContext2D;
  fallbackFace(ctx);
  if (!src) return face;
  const image = new Image();
  image.onload = () => {
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 16, 16);
  };
  image.src = src;
  return face;
}

onMounted(() => {
  const ctx = votez.value?.getContext("2d") as CanvasRenderingContext2D;
  const tx = width.value;
  const ty = height.value;
  const grav = 0.99;

  if (votez.value) {
    votez.value.width = tx;
    votez.value.height = ty;
  }

  const balls: Face[] = [];

  function createBall(src: string): Face {
    const radius = 25;
    return {
      face: pixelFace(src),
      radius,
      x: Math.random() * (tx - radius * 2) + radius,
      y: Math.random() * (ty - radius),
      dy: Math.random() * 2,
      dx: Math.round((Math.random() - 0.5) * 10),
      vel: Math.random() / 5,
    };
  }

  function draw(ball: Face) {
    const x = Math.round(ball.x);
    const y = Math.round(ball.y);
    ctx.fillStyle = "#14080c";
    ctx.fillRect(x + SHADOW, y + SHADOW, SIZE, SIZE);
    ctx.drawImage(ball.face, x, y, SIZE, SIZE);
  }

  function animate() {
    frame = requestAnimationFrame(animate);
    ctx.clearRect(0, 0, tx, ty);
    ctx.imageSmoothingEnabled = false;

    for (const ball of balls) {
      draw(ball);
      ball.y += ball.dy;
      ball.x += ball.dx;

      if (ball.y + ball.radius >= ty) {
        ball.dy = -ball.dy * grav;
      } else {
        ball.dy += ball.vel;
      }

      if (
        ball.x + ball.radius > tx ||
        ball.x - ball.radius < 0
      ) {
        ball.dx = -ball.dx;
      }
    }
  }

  animate();

  watch(votes, (newVotes) => {
    const added = JSON.parse(JSON.stringify(newVotes));
    added.forEach((vote: Vote) => {
      balls.push(createBall(vote.user_avatar));
    });
  }, { flush: "sync" });

  timer = setInterval(function () {
    balls.splice(0, 1);
  }, 5000);
});
</script>

<template>
  <canvas ref="votez" :style="{ height: `${height}px` }" aria-hidden="true" />
</template>
