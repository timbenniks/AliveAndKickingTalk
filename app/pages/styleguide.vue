<script setup lang="ts">
import type { Song } from '~/types';

// Dev-only reference for the Rock Anthem design system.
if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Page not found' });

useHead({ title: 'Styleguide · Alive and Kicking: Rock Anthem' });

const { data: songs } = await useFetch<Song[]>('/api/songs');
const picks = computed(() => (songs.value || []).slice(0, 3));

const colors = [
  ['night', 'Stage haze. Page background.'],
  ['tolex', 'Amp covering. Panels.'],
  ['tolex-hi', 'Raised tolex. Disabled and quiet edges.'],
  ['bone', 'Gig-poster paper. Body text.'],
  ['dust', 'Secondary text.'],
  ['gold', 'Amp piping. Primary action, only one per screen.'],
  ['ink', 'Hard pixel shadow.'],
];
const frets = ['Low E', 'A', 'D', 'G', 'B', 'High E'];

// Screens: the real vote components on real songs. State is changed in this
// tab's store only (nothing is written to Supabase): one vote on the second
// song, and two mashup spots picked.
const songStore = useSongStore();
await songStore.getSongs();
songStore.songs.forEach((song, index) => {
  song.voted = index === 1;
  song.mashupSpot = index === 3 ? 1 : index === 5 ? 2 : null;
});

// A fake meter so the strip can be seen moving.
const levels = ref([0, 0, 0, 0, 0, 0]);
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { levels.value = [0.9, 0.4, 0.7, 0.2, 0.6, 0.3]; return; }
  timer = setInterval(() => { levels.value = levels.value.map(() => Math.random()); }, 180);
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <main class="styleguide">
    <header class="sg-mast">
      <p class="sg-eyebrow">Design system</p>
      <PixelLabel text="Rock Anthem" :scale="10" color="#ffc531" :max-cols="20" class="sg-title" />
      <p class="sg-lede">Everything on stage and in the audience is built from these parts. One pixel is 4px. Corners are notched, shadows are hard, and the six fret colors only ever mean a lane, a string or a song.</p>
      <FretStrip :height="12" />
    </header>

    <section class="sg-section">
      <h2>Color</h2>
      <div class="sg-swatches">
        <div v-for="[name, use] in colors" :key="name" class="sg-swatch">
          <span class="px-frame" :style="{ background: `var(--color-${name})`, '--edge': 'var(--color-tolex-hi)' }" />
          <code>{{ name }}</code>
          <p>{{ use }}</p>
        </div>
      </div>
      <h3>Frets</h3>
      <div class="sg-frets">
        <PixelBadge v-for="(string, i) in frets" :key="string" :fret="i + 1">{{ i + 1 }} · {{ string }}</PixelBadge>
      </div>
    </section>

    <section class="sg-section">
      <h2>Type</h2>
      <PixelLabel text="Back in Black" :scale="6" :max-cols="24" />
      <p class="sg-note">Canvas 5×7 font for big titles on stage, the same font as the 3D gates. Decorative: always paired with real text for screen readers.</p>
      <p class="sg-h1">Vote for the next anthem</p>
      <p class="sg-note">Jersey 10. Headings and buttons.</p>
      <p class="sg-body">Pick up to three songs. The crowd decides what Tim plays next, and your face joins the pit when you vote.</p>
      <p class="sg-note">Barlow Semi Condensed 400/500. Body text.</p>
      <p class="sg-caps">Amp preset · Face bleeding solo</p>
      <p class="sg-note">Silkscreen. Small labels only.</p>
    </section>

    <section class="sg-section">
      <h2>Stompbox buttons</h2>
      <div class="sg-row">
        <PixelButton size="lg">Vote</PixelButton>
        <PixelButton>Vote</PixelButton>
        <PixelButton variant="secondary">Remove vote</PixelButton>
        <PixelButton variant="danger">Reset all votes</PixelButton>
        <PixelButton disabled>Voting closed</PixelButton>
        <PixelButton to="/practise" variant="secondary">Practise</PixelButton>
      </div>
      <p class="sg-note">Press one. It drops a pixel like a footswitch. Gold is the one primary action per screen.</p>
    </section>

    <section class="sg-section">
      <h2>Faces</h2>
      <div class="sg-row">
        <PixelAvatar src="https://github.com/timbenniks.png" alt="Tim Benniks" :size="64" />
        <PixelAvatar src="https://github.com/timbenniks.png" alt="Tim Benniks" />
        <PixelAvatar src="https://github.com/timbenniks.png" alt="Tim Benniks" :size="32" />
        <PixelAvatar src="/does-not-exist.png" alt="Fan without a photo" />
      </div>
      <p class="sg-note">Every face is drawn at 16×16. Missing photos fall back to the pixel fan.</p>
    </section>

    <section class="sg-section">
      <h2>Panels</h2>
      <div class="sg-cards">
        <PixelPanel v-for="(song, i) in picks" :key="song.songId" :fret="i + 1" tag="article" class="sg-card">
          <img :src="song.cover" :alt="`${song.song} cover`" class="pixelated">
          <PixelBadge :fret="i + 1">{{ song.length }}</PixelBadge>
          <h3>{{ song.song }}</h3>
          <p>{{ song.artist }}</p>
          <PixelButton :variant="i === 0 ? 'secondary' : 'primary'">{{ i === 0 ? 'Remove vote' : 'Vote' }}</PixelButton>
        </PixelPanel>
        <PixelPanel class="sg-card">
          <h3>Plain panel</h3>
          <p>No fret color when the panel is not about a song or a lane.</p>
        </PixelPanel>
      </div>
    </section>

    <section class="sg-section">
      <h2>Screens</h2>
      <p class="sg-note">The audience vote screens with real songs. Votes here are local to this tab and never saved.</p>
      <h3>Song vote</h3>
      <div class="sg-screen">
        <regular-vote />
      </div>
      <h3>Mashup vote</h3>
      <div class="sg-screen">
        <mashup-vote />
      </div>
    </section>

    <section class="sg-section">
      <h2>Fret strip</h2>
      <FretStrip />
      <p class="sg-note">Static: a divider that says "this is the rig".</p>
      <FretStrip :levels="levels" :height="48" />
      <p class="sg-note">With levels: a live lane meter.</p>
    </section>
  </main>
</template>

<style>
.styleguide {
  min-height: 100dvh;
  background: var(--color-night);
  color: var(--color-bone);
  padding: 2.5rem max(1rem, calc((100% - 1080px) / 2)) 6rem;
  font-family: var(--font-sans);
}
.sg-section > h2 { font-family: var(--font-pixel); font-weight: 400; font-size: 2.5rem; line-height: 1; margin-bottom: 1.25rem; }
.sg-section > h3 { font-family: var(--font-pixel); font-weight: 400; font-size: 1.75rem; line-height: 1; margin: 1.25rem 0 0.75rem; }
.sg-mast { display: grid; gap: 1.25rem; margin-bottom: 3rem; }
.sg-title { width: min(100%, 720px); height: auto; image-rendering: pixelated; }
.sg-eyebrow, .sg-caps { font-family: var(--font-caps); text-transform: uppercase; color: var(--color-gold); font-size: 0.8rem; }
.sg-lede { max-width: 60ch; font-size: 1.25rem; line-height: 1.4; color: var(--color-dust); }
.sg-section { padding: 2rem 0; border-top: var(--px) solid var(--color-tolex); }
.sg-swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1.25rem; }
.sg-swatch span { display: block; height: 64px; }
.sg-swatch code { display: block; margin-top: 0.75rem; font-family: var(--font-caps); font-size: 0.8rem; }
.sg-swatch p { color: var(--color-dust); font-size: 0.95rem; line-height: 1.3; }
.sg-frets, .sg-row { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; }
.sg-h1 { font-family: var(--font-pixel); font-weight: 400; font-size: clamp(2.75rem, 8vw, 4.5rem); line-height: 0.9; margin-top: 1.5rem; }
.sg-body { font-size: 1.25rem; line-height: 1.4; max-width: 60ch; margin-top: 1.5rem; }
.sg-caps { margin-top: 1.5rem; }
.sg-note { color: var(--color-dust); font-size: 0.95rem; margin-top: 0.5rem; }
.sg-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.75rem; }
.sg-card { display: grid; gap: 0.5rem; align-content: start; justify-items: start; }
.sg-card img { aspect-ratio: 1; object-fit: cover; margin-bottom: 0.5rem; }
.sg-card h3 { margin: 0; line-height: 1.1; }
.sg-card p { color: var(--color-dust); margin-bottom: 0.75rem; }
/* A screen-sized frame; transform contains the screens' fixed overlays. */
.sg-screen { position: relative; overflow: hidden; transform: translateZ(0); height: 860px; overflow-y: auto; box-shadow: 0 0 0 var(--px) var(--color-tolex-hi); }
</style>
