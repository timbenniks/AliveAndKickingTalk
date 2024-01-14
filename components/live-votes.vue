<script setup lang="ts">
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Ref } from "vue";
import type { Vote, Ball } from "../types";

const votez: Ref<HTMLCanvasElement | null> = ref(null);
const client = useSupabaseClient();
let realtimeChannel: RealtimeChannel;

const { data: votes, refresh: refreshVotes } = await useAsyncData(
  "votes",
  async () => {
    const { data } = await client
      .from("votes")
      .select("userid, user_avatar, songid")
      .order("created_at", { ascending: false })
      .limit(1);

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
      ctx.beginPath();
      ctx.drawImage(this.image, this.x, this.y);
      ctx.fill();
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
      let avatar = "";

      if (vote.user_avatar.includes("/u/")) {
        avatar = `https://res.cloudinary.com/dwfcofnrd/image/upload/w_40,r_100,q_auto,f_png/github/${vote.user_avatar
          .split("/u/")[1]
          .replace("?v=4", "")}`;
      } else {
        avatar = `https://res.cloudinary.com/dwfcofnrd/image/upload/w_40,r_100,q_auto,f_png/twitter/${vote.user_avatar
          .split("/profile_images/")[1]
          .replace("_normal", "")}`;
      }

      balls.push(new (Ball as any)(avatar) as Ball);
    });
  });

  setInterval(function () {
    balls.splice(0, 1);
  }, 5000);
});

onUnmounted(() => {
  client.removeChannel(realtimeChannel);
});
</script>

<template>
  <canvas ref="votez" :style="{ height: `${height}px` }"></canvas>
</template>
