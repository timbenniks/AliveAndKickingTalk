<script setup lang="ts">
import { storeToRefs } from "pinia";

const songStore = useSongStore();
const { allSongs, votedAmount, maxVotes, savingVotes } = storeToRefs(songStore);

// Fret colors mark the songs you voted for: one color per song, in setlist order.
const fretFor = (index: number) => (index % 6) + 1;
const full = computed(() => votedAmount.value >= maxVotes.value);

// The row flips the moment you tap; the store saves it in the background.
function toggle(songId: string, voted: boolean) {
  if (!voted && full.value) return;
  if (songStore.toggleVote(songId) && !voted) navigator.vibrate?.(12);
}

// Sharing lives outside the list so rows never change height: one Share
// button in the header for all picks, and a one-time nudge once every vote
// is used (the moment people are done and most likely to share).
const picks = computed(() => allSongs.value.filter(song => song.voted));
const pickKey = computed(() => picks.value.map(song => song.songId).join(","));
const NUDGE_KEY = "alive-picks-nudged";
const nudge = ref(false);
watch(full, (now) => {
  if (!now) { nudge.value = false; return; }
  try {
    if (sessionStorage.getItem(NUDGE_KEY)) return;
    sessionStorage.setItem(NUDGE_KEY, "1");
  } catch { /* Private mode: show it anyway. */ }
  nudge.value = true;
});

function label(song: { song: string; artist: string; voted: boolean }) {
  if (song.voted) return `Remove your vote for ${song.song} by ${song.artist}`;
  if (full.value) return `${song.song} by ${song.artist}. No votes left`;
  return `Vote for ${song.song} by ${song.artist}`;
}
</script>

<template>
  <main class="vote-page">
    <header class="vote-head">
      <div class="vote-top">
        <p class="vote-eyebrow">Alive and Kicking: Rock Anthem Edition</p>
        <SongShare v-if="picks.length" :key="pickKey" class="vote-head-share" nativecopy="Share" :picks="picks" :mashup="false" />
      </div>
      <h1 class="vote-title">Vote for the next anthem</h1>
      <div class="vote-meter" :class="{ 'is-full': full }">
        <span class="vote-pips" aria-hidden="true">
          <i v-for="slot in maxVotes" :key="slot" :class="{ on: slot <= votedAmount }" />
        </span>
        <p class="vote-meter-text" aria-live="polite" :class="{ 'is-saving': savingVotes }">
          <template v-if="full">All {{ maxVotes }} votes used. Tap a pick to free one.</template>
          <template v-else-if="votedAmount">{{ votedAmount }} of {{ maxVotes }} votes used</template>
          <template v-else>Pick up to {{ maxVotes }} songs</template>
        </p>
      </div>
    </header>

    <ol class="vote-list">
      <li
        v-for="(song, index) in allSongs"
        :key="song.songId"
        class="vote-row"
        :class="{ 'is-voted': song.voted, 'is-locked': !song.voted && full }"
        :style="{ '--fret': `var(--color-fret-${fretFor(index)})` }"
      >
        <button
          type="button"
          class="vote-toggle"
          :aria-pressed="song.voted"
          :aria-label="label(song)"
          :aria-disabled="!song.voted && full ? 'true' : undefined"
          @click="toggle(song.songId, song.voted)"
        >
          <img
            class="vote-cover"
            :src="song.cover.replace('q_auto,f_auto', 'q_auto,f_auto,w_160,h_160')"
            alt=""
            width="64"
            height="64"
          >
          <span class="vote-copy">
            <span class="vote-song">{{ song.song }}</span>
            <span class="vote-artist">{{ song.artist }}</span>
          </span>
          <span class="vote-box" aria-hidden="true">
            <svg v-if="song.voted" viewBox="0 0 7 6" shape-rendering="crispEdges">
              <path d="M6 0h1v1h-1zM5 1h2v1h-2zM0 2h1v1h-1zM4 2h2v1h-2zM0 3h2v1h-2zM3 3h2v1h-2zM1 4h3v1h-3zM2 5h1v1h-1z" fill="currentColor" />
            </svg>
            <svg v-else viewBox="0 0 8 8" shape-rendering="crispEdges">
              <path d="M3 1h2v2h2v2H5v2H3V5H1V3h2z" fill="currentColor" />
            </svg>
          </span>
        </button>
      </li>
    </ol>

    <FretStrip class="vote-foot" />

    <Transition name="nudge">
      <aside v-if="nudge" class="vote-nudge pixel-panel px-frame" aria-labelledby="nudge-title">
        <button type="button" class="vote-nudge-close" aria-label="Close" @click="nudge = false"><close /></button>
        <p id="nudge-title" class="vote-nudge-title">Your picks are in</p>
        <p class="vote-nudge-list">{{ picks.map(song => song.song).join(" · ") }}</p>
        <SongShare :key="pickKey" nativecopy="Share my picks" :picks="picks" :mashup="false" primary />
      </aside>
    </Transition>
  </main>
</template>

<style>
.vote-page {
  min-height: 100dvh;
  padding-bottom: 2.5rem;
  background: var(--color-night);
  color: var(--color-bone);
  font-family: var(--font-sans);
}

/* The header stays put so the vote count is always in view. */
.vote-head {
  position: sticky;
  top: 0;
  z-index: 2;
  display: grid;
  gap: 0.5rem;
  padding: 1rem max(1rem, calc((100% - 560px) / 2)) 0.875rem;
  background: color-mix(in srgb, var(--color-night) 94%, transparent);
  box-shadow: 0 var(--px) 0 var(--color-ink);
  backdrop-filter: blur(6px);
}
.vote-eyebrow { font-family: var(--font-caps); font-size: 0.65rem; text-transform: uppercase; color: var(--color-gold); }
.vote-title { font-family: var(--font-pixel); font-size: clamp(2rem, 9vw, 2.75rem); line-height: 0.95; }
.vote-meter { display: flex; align-items: center; gap: 0.75rem; min-height: 1.5rem; }
.vote-pips { display: flex; gap: calc(var(--px) * 1.5); }
.vote-pips i {
  width: calc(var(--px) * 4);
  height: calc(var(--px) * 4);
  background: var(--color-tolex-hi);
  box-shadow: inset 0 calc(var(--px) * -1) 0 var(--color-ink);
}
.vote-pips i.on { background: var(--color-gold); animation: pip-in 180ms steps(3); }
.vote-meter-text { font-size: 1rem; color: var(--color-dust); }
.vote-meter.is-full .vote-meter-text { color: var(--color-bone); }
/* A quiet blink on the count while votes save in the background. */
.vote-meter-text.is-saving::after { content: " · saving"; color: var(--color-gold); animation: saving 0.8s steps(2) infinite; }
@keyframes saving { 50% { opacity: 0.3; } }

.vote-list { display: grid; gap: 0.75rem; padding: 1rem max(1rem, calc((100% - 560px) / 2)) 0; }

.vote-row {
  --edge: var(--color-tolex-hi);
  display: grid;
  margin: var(--px);
  background: var(--color-tolex);
  box-shadow:
    0 calc(-1 * var(--px)) 0 0 var(--edge),
    0 var(--px) 0 0 var(--edge),
    calc(-1 * var(--px)) 0 0 0 var(--edge),
    var(--px) 0 0 0 var(--edge),
    var(--px) calc(var(--px) * 2) 0 0 var(--color-ink),
    calc(var(--px) * 2) var(--px) 0 0 var(--color-ink);
}
.vote-row.is-voted { --edge: var(--fret); background: color-mix(in srgb, var(--fret) 14%, var(--color-tolex)); }
.vote-row.is-locked { opacity: 0.5; }

.vote-toggle {
  display: grid;
  grid-template-columns: 64px 1fr auto;
  gap: 0.875rem;
  align-items: center;
  width: 100%;
  min-height: 80px;
  padding: 0.5rem 0.75rem 0.5rem 0.5rem;
  text-align: left;
  color: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.vote-toggle[aria-disabled="true"] { cursor: not-allowed; }
.vote-toggle:active:not([aria-disabled="true"]) { transform: translate(var(--px), var(--px)); }
.vote-cover { width: 64px; height: 64px; object-fit: cover; box-shadow: var(--px) var(--px) 0 var(--color-ink); }
.vote-copy { display: grid; gap: 0.15rem; min-width: 0; }
.vote-song { font-family: var(--font-pixel); font-size: 1.5rem; line-height: 1; overflow-wrap: anywhere; }
.vote-artist { font-size: 0.95rem; color: var(--color-dust); }

/* The vote box: an empty plus, then a gold check once it's yours. */
.vote-box {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  background: var(--color-night);
  color: var(--color-dust);
  box-shadow: inset 0 0 0 var(--px) var(--color-tolex-hi);
}
.vote-box svg { width: 22px; height: 22px; }
.vote-row.is-voted .vote-box { background: var(--color-gold); color: var(--color-ink); box-shadow: var(--px) var(--px) 0 var(--color-ink); animation: box-in 200ms steps(4); }
.vote-toggle:hover:not([aria-disabled="true"]) .vote-box { color: var(--color-bone); }

/* Space for the Share button is always reserved, so the header never grows. */
.vote-top { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; min-height: 2.25rem; }
.vote-head-share .stompbox { font-size: 0.95rem; padding: 0.2rem 0.65rem; }
.vote-head-share .share-vote-row { gap: 0.5rem; }

/* One-time nudge, above the ROCK! bar when that is showing. */
.vote-nudge {
  --edge: var(--color-gold);
  position: fixed;
  left: 1rem;
  right: 1rem;
  bottom: calc(var(--show-bar, 0px) + 1rem);
  z-index: 6;
  max-width: 520px;
  margin: 0 auto;
  display: grid;
  gap: 0.5rem;
  padding: 1rem 1rem 1.125rem;
}
.vote-nudge-title { font-family: var(--font-pixel); font-size: 1.75rem; line-height: 1; padding-right: 2.5rem; }
.vote-nudge-list { color: var(--color-dust); font-size: 0.95rem; line-height: 1.3; margin-bottom: 0.25rem; }
.vote-nudge-close { position: absolute; top: 0.5rem; right: 0.5rem; width: 2.5rem; height: 2.5rem; display: grid; place-items: center; color: var(--color-bone); cursor: pointer; }
.vote-nudge-close svg { width: 1rem; height: 1rem; }
.nudge-enter-active, .nudge-leave-active { transition: transform 220ms steps(5), opacity 220ms steps(5); }
.nudge-enter-from, .nudge-leave-to { transform: translateY(calc(var(--px) * 6)); opacity: 0; }

/* Space for the Share button is always reserved, so the header never grows. */
.vote-top { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; min-height: 2.25rem; }
.vote-head-share .stompbox { font-size: 0.95rem; padding: 0.2rem 0.65rem; }
.vote-head-share .share-vote-row { gap: 0.5rem; }

/* One-time nudge, above the ROCK! bar when that is showing. */
.vote-nudge {
  --edge: var(--color-gold);
  position: fixed;
  left: 1rem;
  right: 1rem;
  bottom: calc(var(--show-bar, 0px) + 1rem);
  z-index: 6;
  max-width: 520px;
  margin: 0 auto;
  display: grid;
  gap: 0.5rem;
  padding: 1rem 1rem 1.125rem;
}
.vote-nudge-title { font-family: var(--font-pixel); font-size: 1.75rem; line-height: 1; padding-right: 2.5rem; }
.vote-nudge-list { color: var(--color-dust); font-size: 0.95rem; line-height: 1.3; margin-bottom: 0.25rem; }
.vote-nudge-close { position: absolute; top: 0.5rem; right: 0.5rem; width: 2.5rem; height: 2.5rem; display: grid; place-items: center; color: var(--color-bone); cursor: pointer; }
.vote-nudge-close svg { width: 1rem; height: 1rem; }
.nudge-enter-active, .nudge-leave-active { transition: transform 220ms steps(5), opacity 220ms steps(5); }
.nudge-enter-from, .nudge-leave-to { transform: translateY(calc(var(--px) * 6)); opacity: 0; }

.vote-foot { margin: 2rem max(1rem, calc((100% - 560px) / 2)) 0; }

@keyframes pip-in { from { transform: scale(1.6); } }
@keyframes box-in { 50% { transform: scale(1.25); } }
@media (prefers-reduced-motion: reduce) {
  .vote-pips i.on, .vote-row.is-voted .vote-box, .vote-meter-text.is-saving::after { animation: none; }
  .nudge-enter-active, .nudge-leave-active { transition: none; }
  .vote-toggle:active:not([aria-disabled="true"]) { transform: none; }
}
</style>
