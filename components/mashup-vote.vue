<script setup lang="ts">
import { storeToRefs } from "pinia";
import type { Song, SelectedSong } from "~/types";

const songStore = useSongStore();
await songStore.getSongs();
await songStore.setVotedState();

const { allSongs, voting } = storeToRefs(songStore);
const showSongSelection = ref(false);
const selectedSongSpot = ref(1);
const selectedSongs: Ref<Song[]> = ref([]);

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
  return availableSongs.value.find((song) => song.mashupSpot === 1) || false;
});

const spot2 = computed(() => {
  return availableSongs.value.find((song) => song.mashupSpot === 2) || false;
});

const spot3 = computed(() => {
  return availableSongs.value.find((song) => song.mashupSpot === 3) || false;
});

const spot4 = computed(() => {
  return availableSongs.value.find((song) => song.mashupSpot === 4) || false;
});

function openSongSelect(spot: number) {
  showSongSelection.value = true;
  selectedSongSpot.value = spot;
}

async function addSong(song: Song) {
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
</script>
<template>
  <main>
    <ul>
      <li>
        1 <button @click="openSongSelect(1)">select song</button>
        <span v-if="spot1"> - {{ spot1.songId }}</span>
      </li>
      <li>
        2 <button @click="openSongSelect(2)">select song</button>
        <span v-if="spot2"> - {{ spot2.songId }}</span>
      </li>
      <li>
        3 <button @click="openSongSelect(3)">select song</button>
        <span v-if="spot3"> - {{ spot3.songId }}</span>
      </li>
      <li>
        4 <button @click="openSongSelect(4)">select song</button>
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
          @click="addSong(song)"
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
