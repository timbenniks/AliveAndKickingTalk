<script setup lang="ts">
const client = useSupabaseAuthClient();

const login = async (provider: "github" | "twitter") => {
  const { error } = await client.auth.signInWithOAuth({ provider });

  if (error) {
    console.error(error);
  }
};

function randomIntFromInterval(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

const background = computed(() => {
  const bgs = [
    {
      x: "34%",
      src: "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,o_30/Alive%20and%20Kicking/tim1.jpg",
    },
    {
      x: "38%",
      src: "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,o_30/Alive%20and%20Kicking/tim2.jpg",
    },
    {
      x: "34%",
      src: "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,o_25/Alive%20and%20Kicking/tim3.jpg",
    },
    {
      x: "32%",
      src: "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,o_60/Alive%20and%20Kicking/tim4.jpg",
    },
    {
      x: "34%",
      src: "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,o_60/Alive%20and%20Kicking/tim5.jpg",
    },
  ];

  return bgs[randomIntFromInterval(0, 4)];
});
</script>
<template>
  <main
    class="bg-cover w-screen h-screen"
    :style="{
      backgroundImage: `url(${background.src})`,
      backgroundPositionX: background.x,
    }"
  >
    <article
      class="w-11/12 md:w-[600px] m-auto text-center relative top-60 md:top-2/4 md:-translate-y-1/2"
    >
      <h1 class="text-4xl md:text-6xl font-black uppercase md:mb-2">
        Connect to vote
      </h1>
      <p class="text-grey text-lg md:text-xl mb-8">
        I promise your data will be handled with care.
      </p>
      <div
        class="flex flex-col space-y-4 m-auto md:mx-0 w-60 md:w-auto md:space-y-0 md:flex-row md:space-x-4 justify-center mb-12"
      >
        <button
          class="cta flex space-x-2 justify-center"
          @click="login('github')"
        >
          <span
            ><img
              src="/github.png"
              loading="lazy"
              width="240"
              height="240"
              class="w-8 block"
              alt="Login with Github"
          /></span>
          <span class="mt-[6px]">Login with GitHub</span>
        </button>
        <!-- <button
          class="cta flex space-x-2 justify-center"
          @click="login('twitter')"
        >
          <span
            ><img
              src="/twitter.png"
              loading="lazy"
              width="240"
              height="240"
              class="w-8 block"
              alt="Login with Twitter" /></span
          ><span class="mt-[6px]">Login with Twitter</span>
        </button> -->
      </div>
    </article>
    <img
      src="/logo.png"
      alt="Alive & Kicking"
      class="absolute bottom-8 right-8 md:w-48 w-36"
    />
    <img
      src="/vueamsterdam.png"
      alt="Vue Amsterdam"
      class="absolute w-48 md:left-8 md:bottom-8 md:top-auto left-2/4 -translate-x-2/4 md:-translate-x-0 top-4"
    />
  </main>
</template>
