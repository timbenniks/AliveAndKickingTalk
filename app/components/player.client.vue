<script lang="ts" setup>
import type { Song } from "~/types";
import type { AudioPlayerEvent } from "~/types/audio";

const props = defineProps<{
  song: Song;
  countdown?: number;
}>();

const time = ref(0);
const visualizerError = ref("");
const { registerSong, connectSong } = useStageAudio();
const emit = defineEmits(["onSongEnded"]);

const { showVolume } = useRuntimeConfig().public;

const route = useRoute();
const { autoplay } = route.query;

function onPlayerPlay({ event, setPlaying }: AudioPlayerEvent) {
  setPlaying(true);
  void connectSong(event.target as HTMLAudioElement).catch(() => {
    visualizerError.value = "The stage could not hear the track. Check your audio output.";
  });
}

function onPlayerLoaded({ event }: AudioPlayerEvent) {
  registerSong(event.target as HTMLAudioElement);
}

function onPlayerPause({ setPlaying }: AudioPlayerEvent) {
  setPlaying(false);
}

function onPlayerEnded({ setPlaying }: AudioPlayerEvent) {
  setPlaying(false);
  emit("onSongEnded");
}

function onPlayerTimeupdate({ event }: AudioPlayerEvent) {
  time.value = (event.target as HTMLAudioElement).currentTime;
}

function onVolumeChange({ event, setVolume }: AudioPlayerEvent) {
  setVolume((event.target as HTMLAudioElement).volume);
}

function remaining(duration: number) {
  return duration ? Math.ceil(duration - time.value) : 0;
}
</script>

<template>
  <audioplayer
    :src="props.song.mp3"
    :muted="false"
    :autoplay="autoplay === 'true'"
    :controls="false"
    :loop="false"
    preload="auto"
    @loadeddata="onPlayerLoaded"
    @play="onPlayerPlay"
    @pause="onPlayerPause"
    @ended="onPlayerEnded"
    @timeupdate="onPlayerTimeupdate"
    @volumechange="onVolumeChange"
  >
    <template
      #controls="{
        togglePlay,
        playing,
        percentagePlayed,
        seekToPercentage,
        convertTimeToDuration,
        volume,
        setVolume,
        duration,
      }"
    >
      <div v-if="!playing" class="dock-bigplay">
        <PixelButton size="lg" @click="togglePlay()">Play {{ song.song }}</PixelButton>
      </div>

      <div
        v-if="countdown && duration && remaining(duration) > 0 && remaining(duration) <= countdown"
        class="dock-countdown"
        aria-live="polite"
      >
        <PixelLabel :text="String(remaining(duration))" :scale="28" color="#ffc531" />
      </div>

      <div class="dock">
        <p v-if="visualizerError" role="alert" class="dock-alert">{{ visualizerError }}</p>
        <div class="dock-transport">
          <PixelButton
            :variant="playing ? 'secondary' : 'primary'"
            :aria-label="playing ? 'Pause backing track' : 'Play backing track'"
            @click="togglePlay()"
          >
            {{ playing ? 'Pause' : 'Play' }}
          </PixelButton>
          <input
            class="dock-track"
            aria-label="Track position"
            type="range"
            min="0"
            max="100"
            step="0.1"
            :value="percentagePlayed.toFixed(1)"
            :style="{ '--played': `${percentagePlayed}%` }"
            @input="seekToPercentage(Number(($event.target as HTMLInputElement).value))"
          >
          <span class="dock-time">{{ convertTimeToDuration(time) }} / {{ convertTimeToDuration(duration) }}</span>
          <details class="dock-rig">
            <summary class="stompbox px-frame stompbox-secondary stompbox-md">Rig</summary>
            <div class="dock-rig-panel pixel-panel px-frame">
              <midi :song="song" :time="time" />
              <label v-if="String(showVolume) === 'true'" class="rig-field">
                <span>Track volume</span>
                <input type="range" min="0" max="1" step="0.1" :value="volume" @input="setVolume(Number(($event.target as HTMLInputElement).value))">
              </label>
              <slot name="rig" />
            </div>
          </details>
        </div>
      </div>
    </template>
  </audioplayer>
</template>

<style>
.dock {
  position: fixed;
  inset: auto 0 0;
  z-index: 30;
  padding: 0.75rem max(1rem, 2vw) 1rem;
  background: linear-gradient(transparent, color-mix(in srgb, var(--color-night) 92%, transparent) 40%);
  font-family: var(--font-sans);
  color: var(--color-bone);
}
.dock-alert { font-family: var(--font-caps); font-size: 0.75rem; color: var(--color-fret-2); margin-bottom: 0.5rem; }
.dock-transport { display: flex; align-items: center; gap: 1.25rem; }
.dock-time { font-family: var(--font-caps); font-size: 0.8rem; white-space: nowrap; color: var(--color-dust); }

/* The track is a run of pixels: gold where it has played, tolex ahead. */
.dock-track {
  flex: 1;
  min-width: 80px;
  height: calc(var(--px) * 3);
  appearance: none;
  background: linear-gradient(to right, var(--color-gold) var(--played, 0%), var(--color-tolex-hi) var(--played, 0%));
  box-shadow: var(--px) var(--px) 0 var(--color-ink);
  cursor: pointer;
}
.dock-track::-webkit-slider-thumb { appearance: none; width: calc(var(--px) * 3); height: calc(var(--px) * 5); background: var(--color-bone); box-shadow: var(--px) var(--px) 0 var(--color-ink); }
.dock-track::-moz-range-thumb { width: calc(var(--px) * 3); height: calc(var(--px) * 5); border: 0; border-radius: 0; background: var(--color-bone); }
.dock-track:focus-visible { outline: var(--px) solid var(--color-fret-4); outline-offset: var(--px); }

.dock-rig { position: relative; }
.dock-rig summary { list-style: none; }
.dock-rig summary::-webkit-details-marker { display: none; }
.dock-rig-panel {
  /* Solid, so the stage never shows through the controls. */
  background: var(--color-night);
  padding: 1.5rem;
  position: absolute;
  right: 0;
  bottom: calc(100% + 1rem);
  width: min(340px, calc(100vw - 2rem));
  max-height: 70dvh;
  overflow-y: auto;
  display: grid;
  gap: 1rem;
}

.dock-bigplay {
  position: fixed;
  inset: 0;
  z-index: 25;
  display: grid;
  place-items: center;
  pointer-events: none;
}
.dock-bigplay > * { pointer-events: auto; }
.dock-countdown {
  position: fixed;
  inset: 0;
  z-index: 24;
  display: grid;
  place-items: center;
  pointer-events: none;
}
.dock-countdown .pixel-label { width: min(40vw, 360px); }

@media (max-width: 600px) {
  .dock-transport { flex-wrap: wrap; gap: 0.75rem; }
  .dock-track { order: -1; flex-basis: 100%; }
}
</style>
