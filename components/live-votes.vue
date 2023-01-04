<script setup lang="ts">
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Ref } from "vue";

const votez: Ref<HTMLCanvasElement | null> = ref(null);

const client = useSupabaseClient();
let realtimeChannel: RealtimeChannel;

const { data: votes, refresh: refreshVotes } = await useAsyncData(
  "votes",
  async () => {
    const { data } = await client
      .from("votes")
      .select("userid, user_avatar, songid");
    return data;
  }
);

const width = ref(window.innerWidth);
const height = ref(window.innerHeight - 80);

onMounted(async () => {
  await nextTick();

  realtimeChannel = client
    .channel("public:votes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "votes" },
      () => refreshVotes()
    );

  realtimeChannel.subscribe();

  const ctx = votez.value?.getContext("2d") as CanvasRenderingContext2D;
  const tx = width.value;
  const ty = height.value;
  const grav = 0.99;

  if (votez.value) {
    votez.value.width = tx;
    votez.value.height = ty;
  }

  interface Ball {
    image: HTMLImageElement;
    radius: number;
    x: number;
    y: number;
    dy: number;
    dx: number;
    vel: number;
    update: any;
  }

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
      ctx.beginPath();
      ctx.drawImage(this.image, this.x, this.y);
      ctx.fill();
    };
  }

  const balls: any = [];

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

    added.forEach((vote: any) => {
      balls.push(
        new Ball(
          `https://res.cloudinary.com/dwfcofnrd/image/fetch/w_40,r_100,q_auto/${vote.user_avatar}`
        )
      );
    });
  });

  setInterval(function () {
    balls.splice(0, 1);
  }, 1000);
});

onUnmounted(() => {
  client.removeChannel(realtimeChannel);
});
</script>

<template>
  <canvas ref="votez" :style="{ height: `${height}px` }"></canvas>
</template>
