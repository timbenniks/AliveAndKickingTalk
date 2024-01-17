<script setup lang="ts">
import { storeToRefs } from "pinia";
import type { Song } from "~/types";

const songStore = useSongStore();
await songStore.getSongs();
songStore.setVotedState();

const { allSongs, voting } = storeToRefs(songStore);
const showSongSelection = ref(false);
const selectedSongSpot = ref(1);
const selectedSongs = computed(() => {
  return allSongs.value.filter((song: Song) => song.mashupSpot !== null);
});

const availableSongs = computed(() => {
  const songsToRemove = selectedSongs.value.map((song) => {
    return song.songId;
  });

  const result = allSongs.value.filter(
    (song) => !songsToRemove.includes(song.songId)
  );

  return result;
});

const spot1 = computed(() => {
  return allSongs.value.find((song) => song.mashupSpot === 1);
});

const spot2 = computed(() => {
  return allSongs.value.find((song) => song.mashupSpot === 2);
});

const spot3 = computed(() => {
  return allSongs.value.find((song) => song.mashupSpot === 3);
});

const spot4 = computed(() => {
  return allSongs.value.find((song) => song.mashupSpot === 4);
});

function openSongSelect(spot: number) {
  showSongSelection.value = true;
  selectedSongSpot.value = spot;
}

async function addVote(song: Song) {
  await songStore.mashupVote(song.songId, selectedSongSpot.value);
  let spotTaken = selectedSongs.value.find(
    (song) => song.mashupSpot === selectedSongSpot.value
  );

  if (spotTaken) {
    spotTaken = song;
  } else {
    selectedSongs.value.push(song);
  }

  showSongSelection.value = false;
}

async function removeVote(spot: number) {
  await songStore.mashupDownVote(spot);
}
</script>
<template>
  <main class="mb-4">
    <div class="p-6 pb-0">
      <h1 class="text-3xl md:text-5xl font-black uppercase flowing-title">
        MASHUP VOTING
      </h1>
      <p>Create your favorite meshup by selecting four songs!</p>
    </div>
    <ul
      class="grid grid-rows-4 grid-cols-1 md:grid-cols-2 md:grid-rows-2 h-auto w-screen"
    >
      <li class="p-6 pb-0 h-[168px]">
        <div v-if="spot1">
          <div
            :style="`background: url(${spot1?.artwork[2].bg}); background-position: 50%`"
            class="p-2 mb-2"
          >
            <figure class="flex space-x-2">
              <img
                :src="
                  spot1?.cover.replace(
                    'q_auto,f_auto',
                    'q_auto,f_auto,w_380,h_380'
                  )
                "
                :alt="`${spot1?.artist} ${spot1?.song}`"
                width="100"
                height="100"
                class="w-20 h-20 fancy-image"
              />
              <figcaption class="block text-left">
                <span class="block uppercase font-black text-lg">{{
                  spot1?.song
                }}</span>
                <span class="block uppercase font-light text-lg">{{
                  spot1?.artist
                }}</span>
              </figcaption>
            </figure>
          </div>

          <div class="flex space-x-2">
            <button class="cta-fancy" @click="openSongSelect(1)">
              change song
            </button>
            <button class="cta" @click="removeVote(1)" :disabled="voting">
              remove song
            </button>
          </div>
        </div>
        <div
          v-else
          class="fancy-image h-full box-border mb-4 flex flex-col justify-center items-center"
        >
          <p class="block uppercase font-black text-lg mb-2">MASHUP SPOT 1</p>
          <button class="cta-fancy" @click="openSongSelect(1)">
            select song
          </button>
        </div>
      </li>
      <li class="p-6 pb-0 h-[168px]">
        <div v-if="spot2">
          <div
            :style="`background: url(${spot2?.artwork[2].bg}); background-position: 50%`"
            class="p-2 mb-2"
          >
            <figure class="flex space-x-2">
              <img
                :src="
                  spot2?.cover.replace(
                    'q_auto,f_auto',
                    'q_auto,f_auto,w_380,h_380'
                  )
                "
                :alt="`${spot2?.artist} ${spot2?.song}`"
                width="100"
                height="100"
                class="w-20 h-20 fancy-image"
              />
              <figcaption class="block text-left">
                <span class="block uppercase font-black text-lg">{{
                  spot2?.song
                }}</span>
                <span class="block uppercase font-light text-lg">{{
                  spot2?.artist
                }}</span>
              </figcaption>
            </figure>
          </div>

          <div class="flex space-x-2">
            <button class="cta-fancy" @click="openSongSelect(2)">
              change song
            </button>
            <button class="cta" @click="removeVote(2)" :disabled="voting">
              remove song
            </button>
          </div>
        </div>
        <div
          v-else
          class="fancy-image h-full box-border mb-4 flex flex-col justify-center items-center"
        >
          <p class="block uppercase font-black text-lg mb-2">MASHUP SPOT 2</p>
          <button class="cta-fancy" @click="openSongSelect(2)">
            select song
          </button>
        </div>
      </li>
      <li class="p-6 pb-0 h-[168px]">
        <div v-if="spot3">
          <div
            :style="`background: url(${spot3?.artwork[2].bg}); background-position: 50%`"
            class="p-2 mb-2"
          >
            <figure class="flex space-x-2">
              <img
                :src="
                  spot3?.cover.replace(
                    'q_auto,f_auto',
                    'q_auto,f_auto,w_380,h_380'
                  )
                "
                :alt="`${spot3?.artist} ${spot3?.song}`"
                width="100"
                height="100"
                class="w-20 h-20 fancy-image"
              />
              <figcaption class="block text-left">
                <span class="block uppercase font-black text-lg">{{
                  spot3?.song
                }}</span>
                <span class="block uppercase font-light text-lg">{{
                  spot3?.artist
                }}</span>
              </figcaption>
            </figure>
          </div>

          <div class="flex space-x-2">
            <button class="cta-fancy" @click="openSongSelect(3)">
              change song
            </button>
            <button class="cta" @click="removeVote(3)" :disabled="voting">
              remove song
            </button>
          </div>
        </div>
        <div
          v-else
          class="fancy-image h-full box-border mb-4 flex flex-col justify-center items-center"
        >
          <p class="block uppercase font-black text-lg mb-2">MASHUP SPOT 3</p>
          <button class="cta-fancy" @click="openSongSelect(3)">
            select song
          </button>
        </div>
      </li>
      <li class="p-6 pb-0 h-[168px]">
        <div v-if="spot4">
          <div
            :style="`background: url(${spot4?.artwork[2].bg}); background-position: 50%`"
            class="p-2 mb-2"
          >
            <figure class="flex space-x-2">
              <img
                :src="
                  spot4?.cover.replace(
                    'q_auto,f_auto',
                    'q_auto,f_auto,w_380,h_380'
                  )
                "
                :alt="`${spot4?.artist} ${spot4?.song}`"
                width="100"
                height="100"
                class="w-20 h-20 fancy-image"
              />
              <figcaption class="block text-left">
                <span class="block uppercase font-black text-lg">{{
                  spot4?.song
                }}</span>
                <span class="block uppercase font-light text-lg">{{
                  spot4?.artist
                }}</span>
              </figcaption>
            </figure>
          </div>

          <div class="flex space-x-2">
            <button class="cta-fancy" @click="openSongSelect(4)">
              change song
            </button>
            <button class="cta" @click="removeVote(4)" :disabled="voting">
              remove song
            </button>
          </div>
        </div>
        <div
          v-else
          class="fancy-image h-full box-border mb-4 flex flex-col justify-center items-center"
        >
          <p class="block uppercase font-black text-lg mb-2">MASHUP SPOT 4</p>
          <button class="cta-fancy" @click="openSongSelect(4)">
            select song
          </button>
        </div>
      </li>
    </ul>
    <div
      v-if="voting"
      class="fixed pointer-events-none h-screen w-screen bg-black bg-opacity-75 top-0 left-0 flex justify-center items-center"
    >
      <loader />
    </div>
    <Transition name="slide-fade">
      <div
        class="fixed w-screen h-full top-0 left-0 z-10 bg-[#000] bg-opacity-95 p-8"
        v-show="showSongSelection"
      >
        <button
          @click="showSongSelection = false"
          class="absolute top-8 right-4"
        >
          <close class="w-8 h-8" />
        </button>

        <h1
          class="text-3xl md:text-5xl font-black uppercase flowing-title leading-none mb-6"
        >
          SELECT SONG {{ selectedSongSpot }}
        </h1>

        <div class="grid grid-cols-2 gap-4" style="grid-auto-rows: 1fr">
          <button
            class="flex no-underline flex-row"
            @click="addVote(song)"
            v-for="song in availableSongs"
            :key="`${selectedSongSpot}-${song.songId}`"
          >
            <figure class="flex flex-col">
              <img
                :src="
                  song?.cover.replace(
                    'q_auto,f_auto',
                    'q_auto,f_auto,w_380,h_380'
                  )
                "
                :alt="`${song?.artist} ${song?.song}`"
                width="100"
                height="100"
                class="w-36 h-36 fancy-image mb-2"
              />
              <figcaption class="block text-left">
                <span class="block uppercase font-black text-md">{{
                  song?.song
                }}</span>
                <span class="block uppercase font-light text-md">{{
                  song?.artist
                }}</span>
              </figcaption>
            </figure>
          </button>
        </div>

        <div
          v-if="voting"
          class="fixed pointer-events-none h-screen w-screen bg-black bg-opacity-75 top-0 left-0 flex justify-center items-center"
        >
          <loader />
        </div>
      </div>
    </Transition>
  </main>
</template>

<style lang="postcss">
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(100vw);
}
</style>
