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

    this.image.onerror = () => {
      this.image.src =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAAAXNSR0IArs4c6QAAAp1JREFUWEfNWFkrRVEUPuvHSIZEETIkipAhETJkKOLFgwcPXjx4UciQoYgyZCiiDBlCJFPELzo6t7t35+yzh7Xs43bvy3nZ9+xvre9b3/72gZ+UaddJ4h98p0y7AOA4rus47JlEgOEjddYFHSAfcK8Q13UdbEHeez16tO/37S1bD69pc2iKpRv6Oy8wwQtCMiIF+JQ+bwdQs3lsQ1nHFZKSArzPXPQ4C2pQ7ISPKlvKQvUYJATXWUvKDqI0JNsASSlbptsHLrJX7AAaRB5wB41GVczAac5qZAAxHcEC5u86yl0LAkygrUgLElwB9vPWQx1EaY+9/Z8Lgp38DQ6QBMykPdWgEIcKNgs2QzYTOjGQU0ktEOOTsFa0pe+g5qRg/kkFhhqm+CJYLt7+M8UoYJYahYXS3Via0R5JCopRAE1aNZzlMFO2F+yg5dmpk6u/IOWRKdrMVPkBjWJLyihnuVcsTFYc6vOgpCUkauOMcGAySjUSgonKoyDACPMdZVo5RlZQ/AnjVcfoRM1tRRwqg0+SOi4MFYxVn6ApRm0kYQD1P8W0w2jNKSmwIg+V2DIUMFNgHak700d+QRPSuCSgRtkJcvhguP6cdidJkE/yARtovDQCRFGl6ojlNRV6m67MgRUpPKtC2P1ZPEm6mm9okT9Cn8RoFdpabmkAxW4ywGxqCZRijByaW+/CNsOyWASfLkLqUNhKIE35PbGh/SG5A2ttxyMtzYiOb+mTpvmDys4nu1udArDu/ovRHl9T3v3MNUj9GkXZSNYp1KWppOeFRnECA6tXABT2vcXSDDXpKsNAxD4Juf3vtA6aLkEa1Ssp1SXq7IHPYAcR9+C/ag/FlCAhyBj8sgusSEopEvIXAqlD33YATZSKH9ERlyY/wF+B/GwL92p+EQAAAABJRU5ErkJggg==";
    };

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
