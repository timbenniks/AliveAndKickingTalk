<script setup lang="ts">
import { storeToRefs } from "pinia";
import { createRealtimeChannel, removeRealtimeChannel } from "../helpers";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Song } from "~/types";

const songStore = useSongStore();
const { allSongs, voting, allPlayedSongs } = storeToRefs(songStore);

let channel: RealtimeChannel;
onMounted(() => {
  channel = createRealtimeChannel("voting_check_played_songs", [
    {
      table: "songs_played",
      event: "INSERT",
      callback: async () => {
        await songStore.getPlayedSongs();
      },
    },
  ]);

  channel.subscribe();
});

onUnmounted(() => {
  window.onbeforeunload = null;
});

onBeforeMount(() => {
  window.onbeforeunload = () => {
    removeRealtimeChannel(channel);
  };
});

const showSongSelection = ref(false);
const selectedSongSpot = ref(1);
const selectedSongs = computed(() => {
  return allSongs.value.filter((song: Song) => song.mashupSpot !== null);
});

const availableSongs = computed(() => {
  const songsToRemove = selectedSongs.value.map((song) => {
    return song.songId;
  });

  const songsMinusVotedSongs = allSongs.value.filter(
    (song) => !songsToRemove.includes(song.songId)
  );

  const playedSongsAsList = allPlayedSongs.value.map((song) => {
    return song.songId;
  });

  const result = songsMinusVotedSongs.filter(
    (song) => !playedSongsAsList.includes(song.songId)
  );

  return result;
});

const spots = computed(() => {
  const result = [];

  for (let i = 0; i < 4; i++) {
    result[i] = allSongs.value.find((song) => song.mashupSpot === i + 1);
  }

  return result;
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
    <div class="p-6">
      <h1
        class="text-3xl md:text-5xl font-black uppercase flowing-title inline-block"
      >
        MASHUP VOTING
        <span class="text-sm">({{ selectedSongs.length }} / 4)</span>
      </h1>
      <p v-if="selectedSongs.length !== 4">
        Create your favorite meshup by selecting <strong>four</strong> songs!
      </p>
    </div>

    <div class="px-6 py-3 fancy-bg" v-if="selectedSongs.length === 4">
      Thank you for selecting <strong>four</strong> songs. Why don't you share
      this mashup on your favorite social media platform? It will help the
      conference and the presenter!

      <SongShare
        class="mt-4"
        buttonclass="cta w-full"
        nativecopy="SHARE YOUR MASHUP"
        :mashup="true"
      />
    </div>
    <ul
      class="p-2 grid grid-rows-4 grid-cols-1 md:grid-cols-2 md:grid-rows-2 h-auto md:h-[calc(100vh-120px)] w-screen gap-2"
    >
      <mashup-vote-song
        v-for="(spot, index) in spots"
        :song="spot"
        :spot="index + 1"
        :key="spot?.songId"
        :voting="voting"
        @removeVote="removeVote"
        @openSongSelect="openSongSelect"
        :playedSongs="allPlayedSongs"
        :allSongs="allSongs"
      />
    </ul>
    <div
      v-if="voting"
      class="fixed pointer-events-none h-screen w-screen bg-black bg-opacity-75 top-0 left-0 flex justify-center items-center"
    >
      <loader />
    </div>
    <Transition name="slide-fade">
      <div
        class="fixed w-screen h-full overflow-y-auto top-0 left-0 z-10 bg-[#000] bg-opacity-95 p-8"
        v-show="showSongSelection"
      >
        <button
          @click="showSongSelection = false"
          class="absolute top-8 right-4"
        >
          <close class="w-8 h-8" />
        </button>

        <h1
          class="text-3xl md:text-5xl font-black uppercase flowing-title leading-none mb-6 inline-block"
        >
          SELECT SONG {{ selectedSongSpot }}
        </h1>

        <div
          class="grid grid-cols-1 gap-2 md:max-w-screen-sm lg:max-w-screen-xl lg:grid-cols-2"
          style="grid-auto-rows: 1fr"
        >
          <button
            class="flex no-underline flex-row"
            @click="addVote(song)"
            v-for="song in availableSongs"
            :key="`${selectedSongSpot}-${song.songId}`"
          >
            <figure class="flex flex-row space-x-2">
              <img
                :src="
                  song?.cover.replace(
                    'q_auto,f_auto',
                    'q_auto,f_auto,w_144,h_144'
                  )
                "
                :alt="`${song?.artist} ${song?.song}`"
                width="144"
                height="144"
                class="w-16 h-16 lg:w-36 lg:h-36 fancy-image mb-2"
              />
              <figcaption class="block text-left">
                <span class="block uppercase font-black text-lg lg:text-2xl">{{
                  song?.song
                }}</span>
                <span class="block uppercase font-light text-lg lg:text-2xl">{{
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
