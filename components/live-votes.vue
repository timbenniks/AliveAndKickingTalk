<script setup lang="ts">
import type { Vote, Ball } from "../types";

import { storeToRefs } from "pinia";
const songStore = useSongStore();
const { theLatestVotes: votes } = storeToRefs(songStore);

const votez: Ref<HTMLCanvasElement | null> = ref(null);

const width = ref(window.innerWidth);
const height = ref(window.innerHeight - 80);

onMounted(async () => {
  await nextTick();

  const ctx = votez.value?.getContext("2d") as CanvasRenderingContext2D;
  const tx = width.value;
  const ty = height.value;
  const grav = 0.99;

  if (votez.value) {
    votez.value.width = tx;
    votez.value.height = ty;
  }

  const balls: Ball[] = [];

  function Ball(this: Ball, src: string) {
    this.image = new Image();
    this.image.src = src;

    this.radius = 25;
    this.x = Math.random() * (tx - this.radius * 2) + this.radius;
    this.y = Math.random() * (ty - this.radius);
    this.dy = Math.random() * 2;
    this.dx = Math.round((Math.random() - 0.5) * 10);
    this.vel = Math.random() / 5;

    this.update = () => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x + 20, this.y + 20, 20, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(this.image, this.x, this.y, 40, 40);
      ctx.restore();
    };
  }

  function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, tx, ty);

    for (let i = 0; i < balls.length; i++) {
      balls[i].update();
      balls[i].y += balls[i].dy;
      balls[i].x += balls[i].dx;

      if (balls[i].y + balls[i].radius >= ty) {
        balls[i].dy = -balls[i].dy * grav;
      } else {
        balls[i].dy += balls[i].vel;
      }

      if (
        balls[i].x + balls[i].radius > tx ||
        balls[i].x - balls[i].radius < 0
      ) {
        balls[i].dx = -balls[i].dx;
      }
    }
  }

  animate();

  watch(votes, (newVotes) => {
    const added = JSON.parse(JSON.stringify(newVotes));
    added.forEach((vote: Vote) => {
      balls.push(new (Ball as any)(vote.user_avatar) as Ball);
    });
  });

  setInterval(function () {
    balls.splice(0, 1);
  }, 5000);
});
</script>

<template>
  <canvas ref="votez" :style="{ height: `${height}px` }"></canvas>
</template>
