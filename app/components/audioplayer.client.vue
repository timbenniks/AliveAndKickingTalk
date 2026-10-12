<script lang="ts" setup>
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
  | "statechanged"
  | "volumechange";

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
  "volumechange",
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
  "volumechange",
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
const playbackError = ref("");
const listeners = new AbortController();
const duration = ref(0);
const volume = ref(0);
const percentagePlayed = ref(0);
const audioMuted = ref(false);

onMounted(async () => {
  await nextTick();
  bindEvents();

  if (player.value?.muted) {
    setMuted(true);
  }

  if (player.value) {
    volume.value = player.value.volume;
  }
});

function bindEvents() {
  EVENTS.forEach((event) => {
    bindAudioEvents(event as events);
  });
}

function bindAudioEvents(which: events) {
  player.value?.addEventListener(
    which,
    (event: Event) => {
      if (which === "loadeddata") {
        duration.value = player.value?.duration || 0;
      }

      if (which === "timeupdate") {
        if (player.value) {
          percentagePlayed.value =
            (player.value.currentTime / player.value.duration) * 100;
        }
      }

      if (which === "volumechange") {
        if (player.value) {
          volume.value = player.value.volume;
        }
      }

      emit(which, { event, ...{ setPlaying, setMuted, setVolume } });
    },
    { capture: true, signal: listeners.signal }
  );
}

function setPlaying(state: boolean) {
  playing.value = state;
}

async function play() {
  playbackError.value = "";
  try {
    await player.value?.play();
    setPlaying(true);
  } catch {
    setPlaying(false);
    playbackError.value = "Playback could not start. Check the audio output and press play again.";
  }
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
  if (player.value) {
    player.value.currentTime = (percentage / 100) * duration.value;
  }
}

function convertTimeToDuration(seconds: number) {
  const mins = (seconds / 60) % 60;
  const secs = seconds % 60;

  return [~~mins, ~~secs].join(":").replace(/\b(\d)\b/g, "0$1");
}

function mute() {
  if (player.value) {
    player.value.muted = true;
  }
  setMuted(true);
}

function unmute() {
  if (player.value) {
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

function setVolume(vol: number) {
  if (player.value) {
    player.value.volume = vol;
  }

  volume.value = vol;
}
onUnmounted(() => { listeners.abort(); player.value?.pause(); });
</script>

<template>
  <div>
    <audio
      ref="player"
      :src="src"
      :muted="muted"
      :autoplay="autoplay"
      :controls="controls"
      :loop="loop"
      :preload="preload"
      :playsinline="true"
    />
    <p v-if="playbackError" role="alert" class="relative z-30 p-4">{{ playbackError }}</p>
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
      :volume="volume"
      :set-volume="setVolume"
    />
  </div>
</template>
