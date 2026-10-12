<script setup lang="ts">
import type { Vote, Ball } from "../types";

import { storeToRefs } from "pinia";
const songStore = useSongStore();
const { theLatestVotes: votes } = storeToRefs(songStore);

const votez: Ref<HTMLCanvasElement | null> = ref(null);

const width = ref(window.innerWidth);
const height = ref(window.innerHeight - 80);

let frame = 0;
let timer: ReturnType<typeof setInterval>;
onUnmounted(() => { cancelAnimationFrame(frame); clearInterval(timer); });

onMounted(() => {


  const ctx = votez.value?.getContext("2d") as CanvasRenderingContext2D;
  const tx = width.value;
  const ty = height.value;
  const grav = 0.99;

  if (votez.value) {
    votez.value.width = tx;
    votez.value.height = ty;
  }

  const balls: Ball[] = [];

  function createBall(src: string): Ball {
    const ball = { image: new Image() } as Ball;
    ball.image.src = src;

    ball.image.onerror = () => {
      ball.image.src =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAAAXNSR0IArs4c6QAAAp1JREFUWEfNWFkrRVEUPuvHSIZEETIkipAhETJkKOLFgwcPXjx4UciQoYgyZCiiDBlCJFPELzo6t7t35+yzh7Xs43bvy3nZ9+xvre9b3/72gZ+UaddJ4h98p0y7AOA4rus47JlEgOEjddYFHSAfcK8Q13UdbEHeez16tO/37S1bD69pc2iKpRv6Oy8wwQtCMiIF+JQ+bwdQs3lsQ1nHFZKSArzPXPQ4C2pQ7ISPKlvKQvUYJATXWUvKDqI0JNsASSlbptsHLrJX7AAaRB5wB41GVczAac5qZAAxHcEC5u86yl0LAkygrUgLElwB9vPWQx1EaY+9/Z8Lgp38DQ6QBMykPdWgEIcKNgs2QzYTOjGQU0ktEOOTsFa0pe+g5qRg/kkFhhqm+CJYLt7+M8UoYJYahYXS3Via0R5JCopRAE1aNZzlMFO2F+yg5dmpk6u/IOWRKdrMVPkBjWJLyihnuVcsTFYc6vOgpCUkauOMcGAySjUSgonKoyDACPMdZVo5RlZQ/AnjVcfoRM1tRRwqg0+SOi4MFYxVn6ApRm0kYQD1P8W0w2jNKSmwIg+V2DIUMFNgHak700d+QRPSuCSgRtkJcvhguP6cdidJkE/yARtovDQCRFGl6ojlNRV6m67MgRUpPKtC2P1ZPEm6mm9okT9Cn8RoFdpabmkAxW4ywGxqCZRijByaW+/CNsOyWASfLkLqUNhKIE35PbGh/SG5A2ttxyMtzYiOb+mTpvmDys4nu1udArDu/ovRHl9T3v3MNUj9GkXZSNYp1KWppOeFRnECA6tXABT2vcXSDDXpKsNAxD4Juf3vtA6aLkEa1Ssp1SXq7IHPYAcR9+C/ag/FlCAhyBj8sgusSEopEvIXAqlD33YATZSKH9ERlyY/wF+B/GwL92p+EQAAAABJRU5ErkJggg==";
    };

    ball.radius = 25;
    ball.x = Math.random() * (tx - ball.radius * 2) + ball.radius;
    ball.y = Math.random() * (ty - ball.radius);
    ball.dy = Math.random() * 2;
    ball.dx = Math.round((Math.random() - 0.5) * 10);
    ball.vel = Math.random() / 5;

    ball.update = () => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(ball.x + 20, ball.y + 20, 20, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(ball.image, ball.x, ball.y, 40, 40);
      ctx.restore();
    };
    return ball;
  }

  function animate() {
    frame = requestAnimationFrame(animate);
    ctx.clearRect(0, 0, tx, ty);

    for (const ball of balls) {
      ball.update();
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
  <canvas ref="votez" :style="{ height: `${height}px` }"/>
</template>
