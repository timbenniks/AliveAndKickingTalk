<script setup lang="ts">
import { storeToRefs } from "pinia";
import { mergePlayedSongsWithAllSongs } from "~/helpers";
import type { Song } from "~/types";
import type { LaneSource } from "#shared/stage/types";
import { stageClock } from "#shared/stage/clock";
import { styleById } from "#shared/stage/styles";
import { lookFor } from "#shared/stage/themes";
import { activeCue, chapterMarks, lengthToSeconds, presetCues } from "#shared/stage/timeline";

// The Rock Anthem stage: song artwork, the 3D highway, and a pixel HUD.
// `live` adds the up-next column; practise mode leaves it out.
const props = defineProps<{ song: Song; mashupMode?: boolean; live?: boolean; backTo?: string }>();

const route = useRoute();
const songStore = useSongStore();
const { allSongs, allPlayedSongs } = storeToRefs(songStore);
const stage = useStageAudio();

const upNext = computed(() => {
  if (props.mashupMode) return mergePlayedSongsWithAllSongs(allSongs, allPlayedSongs);
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

const cues = computed(() => presetCues(props.song));
const marks = computed(() => chapterMarks({ cues: cues.value, sections: [] }));
const duration = computed(() => lengthToSeconds(props.song.length) ?? 0);
const theme = shallowRef(lookFor("neon-stadium"));
const stageStyle = shallowRef(styleById("stadium-smoke"));
let lastCueId = "-";

const chapters = ref<{ render: (time: number) => void } | null>(null);
const debugText = ref<HTMLElement | null>(null);
const rigOpen = ref(false);

stage.onTick(() => {
  const cue = activeCue(cues.value, stageClock.time);
  if ((cue?.id ?? "") !== lastCueId) {
    lastCueId = cue?.id ?? "";
    theme.value = lookFor(cue?.theme);
    stageStyle.value = styleById(cue?.style);
  }
  chapters.value?.render(stageClock.time);
  if (rigOpen.value && debugText.value) {
    debugText.value.textContent = `lanes ${stageClock.lanes.map(l => l.toFixed(2)).join(" ")}\nenergy ${stageClock.energy.toFixed(2)} · ${stageClock.analysis}\ntheme ${theme.value.id}`;
  }
});

// Artwork plates cross-fade behind the stage.
const plates = computed(() => props.song.artwork ?? []);
const artIndex = ref(0);
let artTimer: ReturnType<typeof setInterval> | undefined;

// Motion and quality.
const prefersReduced = ref(false);
const forceReduced = ref(false);
const lowQuality = ref(false);
const webglOk = ref(false);
const surfaceReady = ref(false);
const baseDpr = ref(1.25);
const reduced = computed(() => prefersReduced.value || forceReduced.value);
const rich = computed(() => !lowQuality.value && !reduced.value);
const dpr = computed(() => rich.value ? baseDpr.value : 1);
const sceneKey = computed(() => `${rich.value ? "high" : "low"}-${plates.value.length ? "art" : "plain"}`);
watch(reduced, value => { stageClock.reducedMotion = value; }, { immediate: true });

let media: MediaQueryList | null = null;
const onMotion = () => { prefersReduced.value = !!media?.matches; };

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch { return false; }
}

const sources: Array<{ id: LaneSource; label: string }> = [
  { id: "song", label: "Backing track" },
  { id: "guitar", label: "Guitar input" },
  { id: "midi", label: "MIDI pickup" },
];

function chooseSource(id: LaneSource) {
  stage.setLaneSource(id);
  if (id === "guitar") void stage.startGuitar();
}

onMounted(() => {
  media = matchMedia("(prefers-reduced-motion: reduce)");
  onMotion();
  media.addEventListener("change", onMotion);
  baseDpr.value = Math.min(devicePixelRatio || 1, 1.5);
  webglOk.value = hasWebGL();
  surfaceReady.value = true;
  artTimer = setInterval(() => {
    if (reduced.value || plates.value.length < 2) return;
    artIndex.value = (artIndex.value + 1) % plates.value.length;
  }, 7000);
});
onUnmounted(() => {
  clearInterval(artTimer);
  media?.removeEventListener("change", onMotion);
});
</script>

<template>
  <main class="stage-page" :class="{ 'stage-live': live }">
    <div v-if="plates.length" class="song-art" aria-hidden="true">
      <img
        v-for="(layer, index) in plates"
        :key="`${song.songId}-${index}`"
        class="plate"
        :class="{ on: reduced ? index === 0 : index === artIndex }"
        :src="layer.bg"
        alt=""
        :style="{ objectPosition: `${layer.x || '50%'} ${layer.y || '50%'}` }"
      >
    </div>

    <div class="stage-canvas" :style="{ background: plates.length ? 'transparent' : theme.background }">
      <StageScene
        v-if="surfaceReady && webglOk"
        :key="sceneKey"
        :transparent="plates.length > 0"
        :marks="marks"
        :reset-key="song.songId"
        :theme="theme"
        :effect="stageStyle.effect"
        :gems="stageStyle.gems"
        :dpr="dpr"
        :rich="rich"
        @error="webglOk = false"
      />
    </div>

    <live-votes v-if="live" class="stage-votes" />

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

      <ChapterRail v-if="marks.length > 1" ref="chapters" :marks="marks" :duration="duration" @seek="stage.seek($event)" />

      <aside v-if="live" class="stage-upnext">
        <mashup-upnext v-if="mashupMode" :current-song="song" :songs="upNext" />
        <upnext v-else :current-song="song" :songs="upNext" />
      </aside>
    </div>

    <player :song="song" :countdown="mashupMode ? 10 : undefined" @on-song-ended="mashupMode && findNextSong()">
      <template #rig>
        <fieldset class="rig-sources">
          <legend class="rig-field"><span>Lanes follow</span></legend>
          <label v-for="source in sources" :key="source.id" class="rig-source">
            <input type="radio" name="lane-source" :checked="stage.laneSource.value === source.id" @change="chooseSource(source.id)">
            {{ source.label }}
          </label>
        </fieldset>
        <template v-if="stage.laneSource.value === 'guitar'">
          <label class="rig-field">
            <span>Guitar input</span>
            <select :value="stage.guitarDeviceId.value" @change="stage.startGuitar(($event.target as HTMLSelectElement).value)">
              <option value="">Default input</option>
              <option v-for="device in stage.guitarDevices.value" :key="device.deviceId" :value="device.deviceId">{{ device.label || 'Audio input' }}</option>
            </select>
          </label>
          <p role="status" class="rig-status">{{ stage.guitarStatus.value }}</p>
          <PixelButton variant="secondary" @click="stage.startGuitar()">Listen to guitar</PixelButton>
        </template>
        <p v-if="stage.laneSource.value === 'midi'" class="rig-status">Pick the pickup under Guitar MIDI input. Channels 1 to 6 light lanes 1 to 6.</p>
        <label class="rig-field">
          <span>Visual offset {{ stage.offsetMs.value }} ms</span>
          <input v-model.number="stage.offsetMs.value" type="range" min="-200" max="200" step="5">
        </label>
        <div class="rig-toggles">
          <PixelButton variant="secondary" :aria-pressed="reduced" @click="forceReduced = !forceReduced">{{ reduced ? 'Motion reduced' : 'Reduce motion' }}</PixelButton>
          <PixelButton variant="secondary" :aria-pressed="lowQuality" @click="lowQuality = !lowQuality">{{ lowQuality ? 'Low quality' : 'High quality' }}</PixelButton>
        </div>
        <details class="rig-debug" @toggle="rigOpen = ($event.target as HTMLDetailsElement).open">
          <summary class="rig-field"><span>Signal</span></summary>
          <pre ref="debugText" />
        </details>
      </template>
    </player>
  </main>
</template>

<style>
.stage-page { min-height: 100dvh; background: var(--color-night); color: var(--color-bone); font-family: var(--font-sans); overflow: hidden; }
.song-art { position: fixed; inset: 0; z-index: 0; background: var(--color-night); pointer-events: none; }
.song-art .plate { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 1.1s linear; }
.song-art .plate.on { opacity: 0.42; }
.stage-canvas { position: fixed; inset: 0; z-index: 1; }
.stage-canvas canvas { display: block; width: 100%; height: 100%; }
.stage-votes { position: fixed; inset: 0; z-index: 2; pointer-events: none; }

.hud { position: relative; z-index: 3; min-height: 100dvh; pointer-events: none; }
.hud a, .hud button, .hud summary, .hud input, .hud select { pointer-events: auto; }

.stage-bill { position: absolute; top: 1rem; left: max(1rem, 2vw); display: grid; gap: 0.5rem; justify-items: start; max-width: min(30vw, 400px); }
.stage-bill h1 { margin: 0; }
.stage-back { font-family: var(--font-caps); font-size: 0.75rem; text-transform: uppercase; color: var(--color-gold); text-decoration: none; }
.stage-alert { font-family: var(--font-caps); font-size: 0.75rem; color: var(--color-fret-2); }

.stage-page { --side: 0px; }
.stage-live { --side: min(20vw, 280px); }
/* Equal insets on both sides keep the amp board centred over the highway. */
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

.rig-sources { display: grid; gap: 0.25rem; border: 0; padding: 0; margin: 0; }
.rig-source { display: flex; gap: 0.5rem; align-items: center; font-size: 1.05rem; cursor: pointer; }
.rig-source input { accent-color: var(--color-gold); }
.rig-toggles { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.rig-debug pre { font-family: var(--font-caps); font-size: 0.65rem; white-space: pre-wrap; color: var(--color-dust); margin-top: 0.5rem; }

@media (max-width: 900px) {
  .stage-bill { max-width: 60vw; }
  .stage-upnext { display: none; }
  .stage-live { --side: 0px; }
}
@media (prefers-reduced-motion: reduce) {
  .song-art .plate { transition: none; }
}
</style>
