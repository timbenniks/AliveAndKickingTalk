<script setup lang="ts">
import { storeToRefs } from "pinia";

const songStore = useSongStore();
await songStore.getSongs();
await songStore.getVotesForSongs();
await songStore.getPlayedSongs();
await songStore.getConfigValues();

const { allSongs, configValues, allPlayedSongs } = storeToRefs(songStore);

setInterval(async () => {
  await songStore.getVotesForSongs();
  await songStore.getPlayedSongs();
}, 5000);

const mashupMode = computed(() => {
  const mashupModeConfKey = configValues.value.find(
    (config) => config.key === "mashup_mode"
  );

  if (mashupModeConfKey) {
    return mashupModeConfKey.val === "true";
  }
});

const songs = computed(() => {
  if (mashupMode.value) {
    const songsOrdered = allSongs.value.sort((a, b) => b.votes - a.votes);
    const playedSongsEnriched = allPlayedSongs.value.map((song) => {
      return {
        ...allSongs.value.find(
          (allSongsSong) => allSongsSong.songId === song.songId
        ),
        mashupSpot: song.mashupSpot,
        blocked: true,
      };
    });

    const remainingSongs = [...songsOrdered];

    for (let song of playedSongsEnriched) {
      const index = remainingSongs.findIndex((s) => s.songId === song.songId);
      if (index !== -1) {
        remainingSongs.splice(index, 1);
      }
    }

    const resultSongs: any = [];

    for (let i = 1; i <= 4; i++) {
      const playedSong = playedSongsEnriched.find(
        (song) => song.mashupSpot === i
      );

      if (playedSong) {
        resultSongs.push(playedSong);
      } else {
        const songToAdd = remainingSongs.shift();

        if (songToAdd) {
          resultSongs.push(songToAdd);
        }
      }
    }

    return resultSongs;
  } else {
    return allSongs.value.sort((a, b) => b.votes - a.votes);
  }
});
</script>

<template>
  <live-vote-overview :songs="songs" :mashup-mode="mashupMode" />
</template>
