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
      event: "*",
      callback: async () => {
        await songStore.getPlayedSongs();
      },
    },
  ]);

  channel.subscribe();
});

onUnmounted(() => {
  if (channel) removeRealtimeChannel(channel);
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

// The first open spot (not picked, not already played) carries the one gold button.
const nextSpot = computed(() => {
  const index = spots.value.findIndex((song, i) =>
    !song && !allPlayedSongs.value.some((played) => played.mashupSpot === i + 1));
  return index + 1;
});

function openSongSelect(spot: number) {
  showSongSelection.value = true;
  selectedSongSpot.value = spot;
}

async function addVote(song: Song) {
  if (await songStore.mashupVote(song.songId, selectedSongSpot.value)) {
    showSongSelection.value = false;
  }
}

async function removeVote(spot: number) {
  await songStore.mashupDownVote(spot);
}
</script>
<template>
  <main class="mashup-page">
    <header class="mashup-head">
      <p class="vote-eyebrow">Alive and Kicking: Rock Anthem Edition</p>
      <h1 class="mashup-title">Build your mashup</h1>
      <p class="mashup-count" aria-live="polite">
        <PixelBadge>{{ selectedSongs.length }} of 4 songs picked</PixelBadge>
      </p>
      <p v-if="selectedSongs.length !== 4" class="mashup-lede">
        Pick four songs. Tim plays them back to back as one medley.
      </p>
    </header>

    <PixelPanel v-if="selectedSongs.length === 4" class="mashup-done">
      <h2 class="mashup-done-title">Your mashup is in</h2>
      <p>Share it so your friends can see what you picked.</p>
      <SongShare nativecopy="Share your mashup" :mashup="true" />
    </PixelPanel>

    <ul class="mashup-spots">
      <mashup-vote-song
        v-for="(spot, index) in spots"
        :key="spot?.songId"
        :song="spot"
        :spot="index + 1"
        :next="index + 1 === nextSpot"
        :voting="voting"
        :played-songs="allPlayedSongs"
        :all-songs="allSongs"
        @remove-vote="removeVote"
        @open-song-select="openSongSelect"
      />
    </ul>

    <div v-if="voting" class="mashup-busy">
      <loader />
    </div>

    <Transition name="slide-fade">
      <div
        v-show="showSongSelection"
        class="mashup-picker"
        role="dialog"
        aria-modal="true"
        :aria-label="`Pick a song for spot ${selectedSongSpot}`"
      >
        <div class="mashup-picker-head">
          <h2 class="mashup-picker-title">Pick song {{ selectedSongSpot }}</h2>
          <button class="mashup-close" aria-label="Close song list" @click="showSongSelection = false">
            <close />
          </button>
        </div>

        <div class="mashup-picker-list">
          <button
            v-for="song in availableSongs"
            :key="`${selectedSongSpot}-${song.songId}`"
            class="mashup-option"
            @click="addVote(song)"
          >
            <img
              :src="song?.cover.replace('q_auto,f_auto', 'q_auto,f_auto,w_144,h_144')"
              :alt="''"
              width="144"
              height="144"
            >
            <span class="mashup-option-copy">
              <span class="mashup-option-song">{{ song?.song }}</span>
              <span class="mashup-option-artist">{{ song?.artist }}</span>
            </span>
          </button>
          <p v-if="!availableSongs.length" class="mashup-lede">Every song is picked or already played.</p>
        </div>

        <div v-if="voting" class="mashup-busy">
          <loader />
        </div>
      </div>
    </Transition>
  </main>
</template>

<style>
.mashup-page {
  min-height: 100dvh;
  padding: 1.25rem 1rem 3rem;
  background: var(--color-night);
  color: var(--color-bone);
  font-family: var(--font-sans);
}
.mashup-head { display: grid; justify-items: start; gap: 0.5rem; margin-bottom: 1.5rem; }
.mashup-title { font-family: var(--font-pixel); font-weight: 400; font-size: clamp(2.5rem, 9vw, 4rem); line-height: 0.9; }
.mashup-lede { color: var(--color-dust); font-size: 1.05rem; max-width: 40ch; }
.mashup-done { display: grid; gap: 0.75rem; justify-items: start; margin-bottom: 1.75rem; }
.mashup-done-title { font-family: var(--font-pixel); font-weight: 400; font-size: 1.75rem; line-height: 1; color: var(--color-gold); }
.mashup-spots { display: grid; grid-template-columns: 1fr; gap: 1.5rem; list-style: none; margin: 0; padding: 0; }
@media (min-width: 48rem) {
  .mashup-page { padding-inline: 2rem; }
  .mashup-spots { grid-template-columns: 1fr 1fr; }
}

.mashup-busy {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--color-night) 75%, transparent);
  pointer-events: none;
}
.mashup-busy .pixel-loader { transform: scale(2); }

.mashup-picker {
  position: fixed;
  inset: 0;
  z-index: 10;
  overflow-y: auto;
  padding: 1.25rem 1rem 2rem;
  background: var(--color-night);
}
.mashup-picker-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }
.mashup-picker-title { font-family: var(--font-pixel); font-weight: 400; font-size: clamp(2.25rem, 8vw, 3.5rem); line-height: 0.9; }
.mashup-close {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  flex: none;
  background: var(--color-tolex);
  color: var(--color-bone);
  box-shadow: var(--px) var(--px) 0 var(--color-ink);
  text-decoration: none;
}
.mashup-close svg { width: 1.25rem; height: 1.25rem; }
.mashup-close:hover { color: var(--color-gold); }
.mashup-picker-list { display: grid; gap: 0.75rem; max-width: 64rem; }
@media (min-width: 64rem) { .mashup-picker-list { grid-template-columns: 1fr 1fr; } }
.mashup-option {
  display: grid;
  grid-template-columns: 4rem 1fr;
  gap: 0.875rem;
  align-items: center;
  padding: 0.5rem;
  background: var(--color-tolex);
  color: var(--color-bone);
  text-align: left;
  text-decoration: none;
  box-shadow: var(--px) var(--px) 0 var(--color-ink);
  cursor: pointer;
}
.mashup-option img { width: 4rem; height: 4rem; object-fit: cover; }
.mashup-option-copy { display: grid; gap: 0.125rem; min-width: 0; }
.mashup-option-song { font-family: var(--font-pixel); font-size: 1.5rem; line-height: 1; }
.mashup-option-artist { color: var(--color-dust); font-size: 0.95rem; }
.mashup-option:hover .mashup-option-song { color: var(--color-gold); }
.mashup-option:active { transform: translate(var(--px), var(--px)); box-shadow: none; }
.mashup-close:focus-visible, .mashup-option:focus-visible { outline: var(--px) solid var(--color-fret-4); outline-offset: var(--px); }

.slide-fade-enter-active,
.slide-fade-leave-active { transition: transform 0.25s steps(5); }
.slide-fade-enter-from,
.slide-fade-leave-to { transform: translateX(100vw); }
@media (prefers-reduced-motion: reduce) {
  .slide-fade-enter-active, .slide-fade-leave-active { transition: none; }
}
</style>
