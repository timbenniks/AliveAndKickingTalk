<script lang="ts" setup>
import type { Ref } from "vue";

type events =
  | "play"
  | "pause"
  | "ended"
  | "loadeddata"
  | "waiting"
  | "playing"
  | "timeupdate"
  | "canplay"
  | "canplaythrough"
  | "statechanged";

const EVENTS = [
  "play",
  "pause",
  "ended",
  "loadeddata",
  "waiting",
  "playing",
  "timeupdate",
  "canplay",
  "canplaythrough",
  "statechanged",
];

const emit = defineEmits([
  "play",
  "pause",
  "ended",
  "loadeddata",
  "waiting",
  "playing",
  "timeupdate",
  "canplay",
  "canplaythrough",
  "statechanged",
]);

defineProps({
  src: { type: String, required: true },
  controls: { type: Boolean, required: false, default: false },
  loop: { type: Boolean, required: false, default: false },
  autoplay: { type: Boolean, required: false, default: false },
  muted: { type: Boolean, required: false, default: false },
  preload: { type: String, required: false, default: "auto" },
});

const player: Ref<HTMLAudioElement | null> = ref(null);
const playing = ref(false);
const duration = ref(0);
const percentagePlayed = ref(0);
const audioMuted = ref(false);

onMounted(async () => {
  await nextTick();
  bindEvents();

  if (player.value?.muted) {
    setMuted(true);
  }
});

function bindEvents() {
  EVENTS.forEach((event) => {
    bindaudioEvent(event as events);
  });
}

function bindaudioEvent(which: events) {
  player.value?.addEventListener(
    which,
    (event: Event) => {
      if (which === "loadeddata") {
        duration.value = player.value?.duration || 0;
      }

      if (which === "timeupdate") {
        if (player.value !== null) {
          percentagePlayed.value =
            (player.value.currentTime / player.value.duration) * 100;
        }
      }

      emit(which, { event, ...{ setPlaying, setMuted } });
    },
    true
  );
}

function setPlaying(state: boolean) {
  playing.value = state;
}

function play() {
  player.value?.play();
  setPlaying(true);
}

function pause() {
  player.value?.pause();
  setPlaying(false);
}

function togglePlay() {
  if (playing.value) {
    pause();
  } else {
    play();
  }
}

function seekToPercentage(percentage: number) {
  if (player.value !== null) {
    player.value.currentTime = (percentage / 100) * duration.value;
  }
}

function convertTimeToDuration(seconds: number) {
  const mins = (seconds / 60) % 60;
  const secs = seconds % 60;

  return [~~mins, ~~secs].join(":").replace(/\b(\d)\b/g, "0$1");
}

function mute() {
  if (player.value !== null) {
    player.value.muted = true;
  }
  setMuted(true);
}

function unmute() {
  if (player.value !== null) {
    player.value.muted = false;
  }
  setMuted(false);
}

function toggleMute() {
  if (audioMuted.value) {
    unmute();
  } else {
    mute();
  }
}

function setMuted(state: boolean) {
  audioMuted.value = state;
}
</script>

<template>
  <div>
    <audio
      :src="src"
      :muted="muted"
      :autoplay="autoplay"
      :controls="controls"
      :loop="loop"
      :preload="preload"
      :playsinline="true"
      ref="player"
    />
    <slot
      name="controls"
      :play="play"
      :pause="pause"
      :toggle-play="togglePlay"
      :playing="playing"
      :percentage-played="percentagePlayed"
      :seek-to-percentage="seekToPercentage"
      :duration="duration"
      :convert-time-to-duration="convertTimeToDuration"
      :audio-muted="audioMuted"
      :toggle-mute="toggleMute"
    ></slot>
  </div>
</template>
