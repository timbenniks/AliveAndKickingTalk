<script setup lang="ts">
import { storeToRefs } from "pinia";
import { mergePlayedSongsWithAllSongs } from "~/helpers";
import type { Song } from "~/types";

const props = defineProps<{ song: Song; mashupMode?: boolean }>();
const route = useRoute();
const songStore = useSongStore();
const { spot } = route.query;
const { allSongs, allPlayedSongs } = storeToRefs(songStore);

const songs = computed(() => {
  if (props.mashupMode) {
    return mergePlayedSongsWithAllSongs(allSongs, allPlayedSongs);
  } else {
    return allSongs.value
      .filter((song) => song.songId !== props.song.songId)
      .sort((a, b) => b.votes - a.votes);
  }
});

async function findNextSong() {
  const currentSpot = Number(spot) - 1;
  const nextSpot = currentSpot + 1;
  const nextSong = songs.value[nextSpot];

  if (nextSong && spot) {
    document.querySelector<HTMLAnchorElement>(`.select-song-${Number(spot) + 1}`)?.click();
  }

  if (!nextSong && spot) {
    await songStore.setConfigValue("active_song", "none");
    location.href = "/band";
  }
}
</script>
<template>
  <main>
    <backgrond-slider :song="song" class="z-0" />
    <live-votes class="z-10 absolute w-screen" />

    <div class="grid grid-cols-7 h-screen w-screen relative z-20">
      <div class="col-span-5 relative">
        <song-details :song="song" />

        <player
          v-if="mashupMode"
          :song="(song as Song)"
          :countdown="10"
          @on-song-ended="findNextSong"
        />
        <player v-else :song="(song as Song)" />

        <img
          src="/logo.png"
          alt="Alive & Kicking"
          class="absolute bottom-24 right-4 w-48 z-20"
        >
      </div>
      <div class="bg-black/60 col-span-2">
        <mashup-upnext v-if="mashupMode" :current-song="song" :songs="songs" />
        <upnext v-else :current-song="song" :songs="songs" />
      </div>
    </div>
  </main>
</template>
