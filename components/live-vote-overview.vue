<script setup lang="ts">
defineProps(["songs", "mashupMode"]);
</script>

<template>
  <section
    class="p-2 grid grid-cols-2 grid-rows-2 w-screen gap-2 relative z-10"
    :class="mashupMode ? 'h-screen' : 'h-auto'"
  >
    <div
      v-for="(song, index) in songs"
      :style="
        !song.blocked ? `background-image: url(${song.artwork[0].bg});` : ''
      "
      class="bg-cover bg-black relative w-full h-full fancy-bg"
    >
      <a
        :href="`/live/${song.songId}?spot=${index + 1}`"
        class="p-8 flex justify-between relative w-full h-full no-underline"
      >
        <figure
          class="flex"
          :class="mashupMode ? 'flex-col' : 'flex-row space-x-4'"
        >
          <img
            :src="
              song?.cover.replace('q_auto,f_auto', 'q_auto,f_auto,w_380,h_380')
            "
            :alt="`${song?.artist} ${song?.song}`"
            width="100"
            height="100"
            class="fancy-image mb-4"
            :class="mashupMode ? 'w-72 h-72' : 'w-44 h-44'"
          />
          <figcaption class="block text-left">
            <span class="block uppercase font-black text-3xl">{{
              song?.song
            }}</span>
            <span class="block uppercase font-light text-3xl">{{
              song?.artist
            }}</span>
          </figcaption>
        </figure>
        <div class="text-right">
          <template v-if="!song.blocked">
            <p class="text-[150px] leading-none font-black flowing-title">
              {{ song.votes }}
            </p>
            <p class="uppercase font-light text-3xl">
              <template v-if="song.votes === 1">vote</template>
              <template v-else>votes</template>
            </p>
          </template>
          <template v-else>
            <p class="uppercase font-black text-3xl">song locked</p>
            <p class="uppercase font-light text-3xl">
              {{ song.votes }}
              <template v-if="song.votes === 1">vote</template>
              <template v-else>votes</template>
            </p>
          </template>
        </div>
      </a>
    </div>
  </section>
  <live-votes class="z-10 absolute w-screen pointer-events-none top-0 left-0" />

  <img
    src="/logo.png"
    alt="Alive & Kicking"
    class="absolute bottom-8 right-8 md:w-48 w-36 z-20"
  />
  <img
    src="/vueamsterdam.png"
    alt="Vue Amsterdam"
    class="z-20 absolute w-48 md:left-8 md:bottom-8 md:top-auto left-2/4 -translate-x-2/4 md:-translate-x-0 top-4"
  />
</template>
