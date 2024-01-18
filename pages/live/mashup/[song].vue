<script setup lang="ts">
import { storeToRefs } from "pinia";

const route = useRoute();
const { song } = route.params;
const { spot, autoplay } = route.query;

const songStore = useSongStore();
const { allSongs } = storeToRefs(songStore);

await songStore.getSongs();
await songStore.getVotesForSongs();
const selectedSong = songStore.getSongById(song as string);

setInterval(async () => {
  await songStore.getVotesForSongs();
}, 5000);

const songs = computed(() => {
  return allSongs.value.sort((a, b) => b.votes - a.votes).slice(0, 4);
});

function findNextSong() {
  const currentSpot = Number(spot) - 1;
  const nextSpot = currentSpot + 1;
  const nextSong = songs.value[nextSpot];

  if (nextSong) {
    window.location.href = `http://localhost:3000/live/mashup/${
      nextSong.songId
    }?spot=${Number(spot) + 1}&autoplay=true`;
  }
}
</script>

<template>
  <main>
    <backgrond-slider :song="selectedSong" class="z-0" />
    <live-votes class="z-10 absolute w-screen" />

    <div class="grid grid-cols-7 h-screen w-screen relative z-20">
      <div class="col-span-5 relative">
        <song-details :song="selectedSong" />
        <player :song="selectedSong" @onSongEnded="findNextSong" />
        <img
          src="/logo.png"
          alt="Alive & Kicking"
          class="absolute bottom-24 right-4 w-48 z-20"
        />
      </div>
      <div class="bg-black bg-opacity-80 col-span-2">
        <mashup-upnext :current-song="selectedSong" :songs="songs" />
      </div>
    </div>
  </main>
</template>

<style lang="postcss">
.v-enter-active,
.v-leave-active {
  transition: opacity 1s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
