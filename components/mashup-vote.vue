<script setup lang="ts">
import { storeToRefs } from "pinia";
import type { Song, SelectedSong } from "~/types";

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
  <main>
    <ul class="grid grid-rows-4 h-screen w-screen">
      <li class="flex space-x-2">
        <span class="text-7xl font-black">1</span>
        <button class="cta-fancy" @click="openSongSelect(1)">
          <template v-if="spot1">change song</template>
          <template v-if="!spot1">select song</template>
        </button>
        <button class="cta" v-if="spot1" @click="removeVote(1)">
          remove song
        </button>
        <span v-if="spot1"> - {{ spot1.songId }}</span>
      </li>
      <li class="flex space-x-2">
        <span class="text-7xl font-black">2</span>
        <button class="cta-fancy" @click="openSongSelect(2)">
          <template v-if="spot2">change song</template>
          <template v-if="!spot2">select song</template>
        </button>
        <button class="cta" v-if="spot2" @click="removeVote(2)">
          remove song
        </button>
        <span v-if="spot2"> - {{ spot2.songId }}</span>
      </li>
      <li class="flex space-x-2">
        <span class="text-7xl font-black">3</span>
        <button class="cta-fancy" @click="openSongSelect(3)">
          <template v-if="spot3">change song</template>
          <template v-if="!spot3">select song</template>
        </button>
        <button class="cta" v-if="spot3" @click="removeVote(3)">
          remove song
        </button>
        <span v-if="spot3"> - {{ spot3.songId }}</span>
      </li>
      <li class="flex space-x-2">
        <span class="text-7xl font-black">4</span>
        <button class="cta-fancy" @click="openSongSelect(4)">
          <template v-if="spot4">change song</template>
          <template v-if="!spot4">select song</template>
        </button>
        <button class="cta" v-if="spot4" @click="removeVote(4)">
          remove song
        </button>
        <span v-if="spot4"> - {{ spot4.songId }}</span>
      </li>
    </ul>
    <Transition name="slide-fade">
      <div
        class="absolute w-screen h-screen top-0 left-0 z-10 bg-[#333]"
        v-show="showSongSelection"
      >
        <button
          @click="showSongSelection = false"
          class="absolute top-2 right-4"
        >
          close
        </button>

        Select song for spot {{ selectedSongSpot }}
        <button
          class="block"
          @click="addVote(song)"
          v-for="song in availableSongs"
          :key="`${selectedSongSpot}-${song.songId}`"
        >
          {{ song.songId }}
        </button>

        <div v-if="voting">loading</div>
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
  transform: translateX(50vw);
  opacity: 0;
}
</style>
