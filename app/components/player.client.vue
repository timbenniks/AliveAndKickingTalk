<script lang="ts" setup>
// https://github.com/WebDevSimplified/Guitar-Amp/blob/master/script.js
import audioplayerVisualizer from "./audioplayer-visualizer.client.vue";
import type { eventReturn, Song } from "../types";

const props = defineProps<{
  song: Song;
  countdown?: number;
}>();

const time = ref(0);
const visualizerError = ref("");
const vizualizer = ref<InstanceType<typeof audioplayerVisualizer>>();
const emit = defineEmits(["onSongEnded"]);

const { showVolume } = useRuntimeConfig().public;

const route = useRoute();
const { autoplay } = route.query;

function onPlayerPlay({ event, setPlaying }: eventReturn) {
  setPlaying(true);

  if (vizualizer.value) {
    void vizualizer.value.init(event.target as HTMLAudioElement).catch(() => {
      visualizerError.value = "The audio visualizer could not start. Check your audio output.";
    });
  }
}

function onPlayerPause({ setPlaying }: eventReturn) {
  setPlaying(false);
}

function onPlayerEnded({ setPlaying }: eventReturn) {
  setPlaying(false);
  emit("onSongEnded");
}

function onPlayerTimeupdate({ event }: eventReturn) {
  time.value = (event.target as HTMLAudioElement).currentTime;
}

function onVolumeChange({ event, setVolume }: eventReturn) {
  setVolume((event.target as HTMLAudioElement).volume);
}
</script>

<template>
  <audioplayer
    class="audioplayer"
    :src="props.song.mp3"
    :muted="false"
    :autoplay="autoplay === 'true'"
    :controls="false"
    :loop="false"
    preload="auto"
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
      <p v-if="visualizerError" role="alert" class="relative z-30">{{ visualizerError }}</p>
      <midi :song="song" :time="time" />

      <audioplayer-visualizer
        ref="vizualizer"
        class="absolute bottom-20 w-full"
      />

      <audioplayer-play
        :playing="playing"
        class="bigplay"
        @bigplay="togglePlay"
      />

      <audioplayer-volume
        v-if="String(showVolume) === 'true'"
        :vol="volume"
        @setvol="setVolume"
      />

      <audioplayer-countdown
        v-if="countdown"
        :time="time"
        :duration="duration"
        :from="countdown"
      />

      <div
        class="bg-black p-6 absolute bottom-0 justify-between h-20 flex w-full space-x-6"
      >
        <button
          class="audioplayer-controls-toggleplay"
          :aria-label="playing ? 'Pause backing track' : 'Resume backing track'"
          :class="{ pause: playing, play: !playing }"
          @click="togglePlay()"
        />
        <audioplayer-track
          :percentage="percentagePlayed"
          class="w-full"
          @seek="seekToPercentage"
        />
        <div class="audioplayer-controls-time">
          {{ convertTimeToDuration(time) }}
        </div>
      </div>
    </template>
  </audioplayer>
</template>

<style lang="postcss">
.audioplayer-controls-toggleplay {
  box-sizing: border-box;
  width: 30px;
  height: 30px;
  border-style: solid;
  cursor: pointer;
}

.audioplayer-controls-toggleplay.play {
  border-width: 15px 0 15px 30px;
  border-color: transparent transparent transparent #fff;
}

.audioplayer-controls-toggleplay.pause {
  border-width: 15px;
  border-color: #fff;
  border-style: double;
  border-width: 0 0 0 15px;
}
</style>
