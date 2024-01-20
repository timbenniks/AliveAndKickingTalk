<script setup lang="ts">
const client = useSupabaseClient();

const login = async (provider: "github" | "twitter" | "linkedin_oidc") => {
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
      x: "29%",
      src: "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,o_70,w_1920,h_1080/Alive%20and%20Kicking/tim1.png",
    },
    {
      x: "69%",
      src: "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,o_50,w_1920,h_1080/Alive%20and%20Kicking/tim2.png",
    },
    {
      x: "34%",
      src: "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,o_50,w_1920,h_1080/Alive%20and%20Kicking/tim3.png",
    },
    {
      x: "21%",
      src: "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,o_70,w_1920,h_1080/Alive%20and%20Kicking/tim4.png",
    },
    {
      x: "10%",
      src: "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,o_50,w_1920,h_1080/Alive%20and%20Kicking/tim5.png",
    },
    {
      x: "10%",
      src: "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,o_80,w_1920,h_1080/Alive%20and%20Kicking/tim6.png",
    },
    {
      x: "23%",
      src: "https://res.cloudinary.com/dwfcofnrd/image/upload/q_auto,f_auto,o_50/Alive%20and%20Kicking/tim7.png",
    },
  ];

  return bgs[randomIntFromInterval(0, 6)];
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
      <h1
        class="text-4xl md:text-6xl font-black uppercase md:mb-2 flowing-title"
      >
        Connect to vote
      </h1>
      <p class="text-grey text-lg md:text-xl mb-8">
        Your data will be handled with care.
      </p>
      <div
        class="flex flex-col space-y-4 m-auto md:mx-0 w-60 md:w-auto md:space-y-0 md:flex-row md:space-x-4 justify-center mb-12"
      >
        <button
          class="cta flex space-x-3 justify-center !w-auto py-3"
          @click="login('github')"
        >
          <span
            ><img
              src="/github.png"
              loading="lazy"
              width="240"
              height="240"
              class="w-8 block"
              alt="Github"
          /></span>
          <span class="mt-[6px]">Github</span>
        </button>
        <button
          class="cta flex space-x-3 justify-center !w-auto py-3"
          @click="login('twitter')"
        >
          <span
            ><img
              src="/twitter.png"
              loading="lazy"
              width="240"
              height="240"
              class="w-8 block"
              alt="Twitter"
          /></span>
          <span class="mt-[6px]">Twitter</span>
        </button>
        <button
          class="cta flex space-x-3 justify-center !w-auto py-3"
          @click="login('linkedin_oidc')"
        >
          <span
            ><img
              src="/linkedin.png"
              loading="lazy"
              width="240"
              height="240"
              class="w-8 block"
              alt="Twitter"
          /></span>
          <span class="mt-[6px]">LinkedIn</span>
        </button>
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
