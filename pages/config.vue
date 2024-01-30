<script setup lang="ts">
import type { Database } from "~/types";

const user = useSupabaseUser();
const client = useSupabaseClient<Database>();
const songStore = useSongStore();
const loading = ref(false);

async function setMashupMode() {
  loading.value = true;
  await songStore.setConfigValue("mashup_mode", true);
  loading.value = false;
}

async function setDefaultMode() {
  loading.value = true;
  await songStore.setConfigValue("mashup_mode", false);
  loading.value = false;
}

async function removeVotes() {
  loading.value = true;
  await client.from("votes").delete().neq("id", 0);
  loading.value = false;
}

async function clearPlayedSongs() {
  loading.value = true;
  await client.from("songs_played").delete().neq("id", 0);
  loading.value = false;
}

async function resetActiveSong() {
  loading.value = true;
  await songStore.setConfigValue("active_song", "none");
  loading.value = false;
}
</script>
<template>
  <main class="p-6">
    <template v-if="user && user.id === 'c9d34b15-6255-4500-9396-9f18f350073d'">
      <header>
        <h1
          class="flowing-title uppercase font-black text-5xl mb-4 inline-block"
        >
          Extra secret config
        </h1>
      </header>

      <button class="cta block mb-4 hover:fancy-bg" @click="resetActiveSong()">
        RESET ACTIVE SONG
      </button>

      <button class="cta block mb-4 hover:fancy-bg" @click="clearPlayedSongs()">
        CLEAR PLAYED SONGS
      </button>
      <button class="cta block mb-4 hover:fancy-bg" @click="removeVotes()">
        REMOVE VOTES
      </button>

      <div class="flex space-x-2 bg-4">
        <button class="cta hover:fancy-bg" @click="setMashupMode()">
          MASHUP MODE
        </button>
        <button class="cta hover:fancy-bg" @click="setDefaultMode()">
          NORMAL MODE
        </button>
      </div>

      <div class="flex space-x-2" v-if="loading">
        <loader /> <span>working...</span>
      </div>
    </template>
    <template v-else>
      <header>
        <h1
          class="flowing-title uppercase font-black text-5xl mb-4 inline-block"
        >
          Nope
        </h1>
      </header>
    </template>
  </main>
</template>
