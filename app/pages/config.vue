<script setup lang="ts">
import type { Database } from "~/types";

const user = useSupabaseUser();
const client = useSupabaseClient<Database>();
const songStore = useSongStore();
const loading = ref(false);
const status = ref("");

// Every action reports what happened, and loading never sticks on a failure.
async function run(done: string, action: () => PromiseLike<unknown>) {
  loading.value = true;
  status.value = "";
  try {
    const result = await action();
    const error = (result as { error?: unknown } | undefined)?.error;
    status.value = error ? "That did not work. Check the connection and try again." : done;
  } catch {
    status.value = "That did not work. Check the connection and try again.";
  } finally {
    loading.value = false;
  }
}

const setMashupMode = () => run("Mashup mode is on.", () => songStore.setConfigValue("mashup_mode", true));
const setDefaultMode = () => run("Normal mode is on.", () => songStore.setConfigValue("mashup_mode", false));
const resetActiveSong = () => run("No song is active.", () => songStore.setConfigValue("active_song", "none"));
const clearPlayedSongs = () => run("Played songs cleared.", () => client.from("songs_played").delete().neq("id", 0));

function removeVotes() {
  if (!confirm("Remove every vote? The mosh pit starts empty and this cannot be undone.")) return;
  void run("All votes removed.", () => client.from("votes").delete().neq("id", 0));
}
</script>

<template>
  <main class="config-page">
    <template v-if="user && user.sub === 'c9d34b15-6255-4500-9396-9f18f350073d'">
      <header>
        <p class="config-eyebrow">Host controls</p>
        <h1>Run the show</h1>
      </header>

      <PixelPanel class="config-group">
        <h2>Voting mode</h2>
        <div class="config-row">
          <PixelButton :disabled="loading" @click="setDefaultMode()">Normal mode</PixelButton>
          <PixelButton :disabled="loading" variant="secondary" @click="setMashupMode()">Mashup mode</PixelButton>
        </div>
      </PixelPanel>

      <PixelPanel class="config-group">
        <h2>Between shows</h2>
        <div class="config-row">
          <PixelButton :disabled="loading" variant="secondary" @click="resetActiveSong()">Reset active song</PixelButton>
          <PixelButton :disabled="loading" variant="danger" @click="clearPlayedSongs()">Clear played songs</PixelButton>
          <PixelButton :disabled="loading" variant="danger" @click="removeVotes()">Remove all votes</PixelButton>
        </div>
      </PixelPanel>

      <PixelPanel class="config-group config-rig">
        <h2>Rig</h2>
        <p class="config-note">Saved in this browser, so set it on the stage laptop. Every song picks it up.</p>
        <midi />
        <StageRigSetup />
      </PixelPanel>

      <p role="status" class="config-status">
        <template v-if="loading"><loader /> Working…</template>
        <template v-else>{{ status }}</template>
      </p>
    </template>
    <template v-else>
      <header>
        <p class="config-eyebrow">Host controls</p>
        <h1>Host only</h1>
        <p class="config-note">Sign in with the host account to run the show.</p>
      </header>
    </template>
  </main>
</template>

<style>
.config-page {
  min-height: 100dvh;
  display: grid;
  align-content: start;
  gap: 1.5rem;
  padding: 2.5rem max(1rem, calc((100% - 760px) / 2)) 4rem;
  background: var(--color-night);
  color: var(--color-bone);
  font-family: var(--font-sans);
}
.config-page h1 { font-family: var(--font-pixel); font-size: clamp(2.5rem, 8vw, 4rem); line-height: 1; }
.config-page h2 { font-family: var(--font-pixel); font-size: 1.75rem; line-height: 1; margin-bottom: 1rem; }
.config-eyebrow { font-family: var(--font-caps); font-size: 0.75rem; text-transform: uppercase; color: var(--color-gold); margin-bottom: 0.5rem; }
.config-note, .config-status { color: var(--color-dust); font-size: 1.1rem; }
.config-status { display: flex; gap: 0.5rem; align-items: center; min-height: 2rem; }
.config-row { display: flex; flex-wrap: wrap; gap: 1rem; }
.config-rig { display: grid; gap: 1rem; justify-items: start; }
.config-rig .rig-field { width: 100%; }
</style>
