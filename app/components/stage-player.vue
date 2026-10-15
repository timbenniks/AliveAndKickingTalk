<script setup lang="ts">
import { storeToRefs } from "pinia";
import { buildSetlist } from "#shared/utils/performance";
import type { Song } from "~/types";
import { stageClock } from "#shared/stage/clock";

// The Rock Anthem stage: the 3D scene, a pixel HUD and the Rig drawer.
// `live` adds the up-next column and the mosh pit; practise leaves them out.
const props = defineProps<{ song: Song; mashupMode?: boolean; live?: boolean; host?: boolean; backTo?: string }>();

const route = useRoute();
const songStore = useSongStore();
const { allSongs, allPlayedSongs } = storeToRefs(songStore);
const stage = useStageAudio();
const { marks, duration, theme, stageStyle, solo } = useStageCues(() => props.song);
const { crowd, toast, simulateVote } = useStageCrowd(() => !!props.live);
const { flying } = useStageIntro(() => props.song);
// Phone taps and the encore vote: live screen only.
const show = props.live ? useStageShow({ host: () => !!props.host, songId: () => props.song.songId }) : null;

const upNext = computed(() => {
  if (props.mashupMode) return buildSetlist(allSongs.value, allPlayedSongs.value);
  return allSongs.value.filter(song => song.songId !== props.song.songId).sort((a, b) => b.votes - a.votes);
});

// Mashup mode: when a song ends, click through to the next spot in the setlist.
async function findNextSong() {
  const spot = Number(route.query.spot);
  if (!spot) return;
  if (upNext.value[spot]) {
    document.querySelector<HTMLAnchorElement>(`.select-song-${spot + 1}`)?.click();
  } else {
    await songStore.setConfigValue("active_song", "none");
    location.href = "/band";
  }
}

const chapters = ref<{ render: (time: number) => void } | null>(null);
stage.onTick(() => chapters.value?.render(stageClock.time));

// The song's artwork plays on the LED wall at the back of the stage.
const art = computed(() => {
  const plates = (props.song.artwork ?? []).map(layer => layer.bg).filter(Boolean);
  return plates.length ? plates : [props.song.cover];
});

// Motion and quality.
const prefersReduced = ref(false);
const { forceReduced, lowQuality } = useRigDisplay();
const webglOk = ref(false);
const surfaceReady = ref(false);
const baseDpr = ref(1.25);
const reduced = computed(() => prefersReduced.value || forceReduced.value);
const rich = computed(() => !lowQuality.value && !reduced.value);
const dpr = computed(() => rich.value ? baseDpr.value : 1);
const sceneKey = computed(() => (rich.value ? "high" : "low"));
watch(reduced, value => { stageClock.reducedMotion = value; }, { immediate: true });

let media: MediaQueryList | null = null;
const onMotion = () => { prefersReduced.value = !!media?.matches; };

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch { return false; }
}

onMounted(() => {
  media = matchMedia("(prefers-reduced-motion: reduce)");
  onMotion();
  media.addEventListener("change", onMotion);
  baseDpr.value = Math.min(devicePixelRatio || 1, 1.5);
  webglOk.value = hasWebGL();
  surfaceReady.value = true;
});
onUnmounted(() => media?.removeEventListener("change", onMotion));
</script>

<template>
  <main class="stage-page" :class="{ 'stage-live': live }">
    <div class="stage-canvas" :style="{ background: theme.background }">
      <StageScene
        v-if="surfaceReady && webglOk"
        :key="sceneKey"
        :art="art"
        :marks="marks"
        :reset-key="song.songId"
        :theme="theme"
        :effect="stageStyle.effect"
        :gems="stageStyle.gems"
        :dpr="dpr"
        :rich="rich"
        :solo="solo"
        :crowd="crowd"
        :meter="live"
        @error="webglOk = false"
      />
    </div>

    <Transition name="vote-toast">
      <p v-if="toast" :key="toast.key" class="vote-toast" role="status">
        <PixelAvatar :src="toast.avatar" alt="" :size="40" />
        <span><span class="vote-toast-label">Vote in</span>{{ toast.song }}</span>
      </p>
    </Transition>

    <div class="hud">
      <header class="stage-bill">
        <NuxtLink v-if="backTo" :to="backTo" class="stage-back">← Setlist</NuxtLink>
        <PixelLabel :text="song.artist" :scale="2" color="#ffc531" :max-cols="24" />
        <h1>
          <span class="sr-only">{{ song.song }} by {{ song.artist }}</span>
          <PixelLabel :text="song.song" :scale="4" :max-cols="16" aria-hidden="true" />
        </h1>
        <p v-if="surfaceReady && !webglOk" class="stage-alert">This browser cannot draw the 3D stage. The track still plays.</p>
      </header>

      <ChapterRail v-if="marks.length > 1" ref="chapters" :class="{ 'is-intro': flying }" :marks="marks" :duration="duration" @seek="stage.seek($event)" />

      <aside v-if="live" class="stage-upnext">
        <mashup-upnext v-if="mashupMode" :current-song="song" :songs="upNext" />
        <upnext v-else :current-song="song" :songs="upNext" />
      </aside>
    </div>

    <StageGuitarNotes />

    <player :song="song" :countdown="mashupMode ? 10 : undefined" @on-song-ended="mashupMode && findNextSong()">
      <template #rig>
        <StageRig
          :live="live"
          :host="host"
          :reduced="reduced"
          :theme-id="theme.id"
          :show="show"
          @simulate-vote="simulateVote"
        />
      </template>
    </player>
  </main>
</template>

<style>
.stage-page { min-height: 100dvh; background: var(--color-night); color: var(--color-bone); font-family: var(--font-sans); overflow: hidden; }
.stage-canvas { position: fixed; inset: 0; z-index: 1; }
.stage-canvas canvas { display: block; width: 100%; height: 100%; }
.vote-toast {
  position: fixed;
  left: max(1rem, 2vw);
  bottom: 5.5rem;
  z-index: 4;
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.5rem 0.875rem 0.5rem 0.5rem;
  background: color-mix(in srgb, var(--color-night) 85%, transparent);
  box-shadow: var(--px) var(--px) 0 var(--color-ink);
  font-family: var(--font-pixel);
  font-size: 1.35rem;
  line-height: 1;
}
.vote-toast-label { display: block; font-family: var(--font-caps); font-size: 0.6rem; text-transform: uppercase; color: var(--color-gold); margin-bottom: 0.25rem; }
.vote-toast-enter-active, .vote-toast-leave-active { transition: transform 160ms steps(4), opacity 160ms steps(4); }
.vote-toast-enter-from, .vote-toast-leave-to { transform: translateY(calc(var(--px) * 4)); opacity: 0; }

.hud { position: relative; z-index: 3; min-height: 100dvh; pointer-events: none; }
.hud a, .hud button, .hud summary, .hud input, .hud select { pointer-events: auto; }

.stage-bill { position: absolute; top: 1rem; left: max(1rem, 2vw); display: grid; gap: 0.5rem; justify-items: start; max-width: min(30vw, 400px); }
.stage-bill h1 { margin: 0; }
.stage-back { font-family: var(--font-caps); font-size: 0.75rem; text-transform: uppercase; color: var(--color-gold); text-decoration: none; }
.stage-alert { font-family: var(--font-caps); font-size: 0.75rem; color: var(--color-fret-2); }

.stage-page { --side: 0px; }
.stage-live { --side: min(20vw, 280px); }
/* Equal insets on both sides keep the amp board centred over the highway. */
.stage-page .chapters { transition: opacity 0.8s ease; }
.stage-page .chapters.is-intro { opacity: 0; pointer-events: none; transition: none; }
.stage-page .chapters { position: absolute; top: 43%; left: var(--side); right: var(--side); width: auto; transform: translateY(-100%); }

.stage-upnext {
  position: absolute;
  top: 2rem;
  right: max(1rem, 1vw);
  max-height: calc(100dvh - 7rem);
  width: calc(var(--side) - 2rem);
  overflow-y: auto;
  pointer-events: auto;
}

@media (max-width: 900px) {
  .stage-bill { max-width: 60vw; }
  .stage-upnext { display: none; }
  .stage-live { --side: 0px; }
}
@media (prefers-reduced-motion: reduce) {
  .vote-toast-enter-active, .vote-toast-leave-active { transition: none; }
}
</style>
