<script lang="ts" setup>
// https://github.com/WebDevSimplified/Guitar-Amp/blob/master/script.js
import audioplayerVisualizer from "./audioplayer-visualizer.client.vue";
import type { eventReturn, Song } from "../types";

const props = defineProps<{
  song: Song;
  countdown?: number;
}>();

const time = ref(0);
const vizualizer = ref<InstanceType<typeof audioplayerVisualizer>>();
const emit = defineEmits(["onSongEnded"]);

const { showVolume } = useRuntimeConfig().public;

const route = useRoute();
const { autoplay } = route.query;

function onPlayerPlay({ setPlaying }: eventReturn) {
  setPlaying(true);

  if (vizualizer.value) {
    vizualizer.value.init();
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
      v-slot:controls="{
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
      <midi :song="song" :time="time" />

      <audioplayer-visualizer
        ref="vizualizer"
        class="absolute bottom-20 w-full"
      />

      <audioplayer-play
        @bigplay="togglePlay"
        :playing="playing"
        class="bigplay"
      />

      <audioplayer-volume
        :vol="volume"
        @setvol="setVolume"
        v-if="showVolume === 'true'"
      />

      <audioplayer-countdown
        :time="time"
        :duration="duration"
        :from="countdown"
        v-if="countdown"
      />

      <div
        class="bg-black p-6 absolute bottom-0 justify-between h-20 flex w-full space-x-6"
      >
        <button
          @click="togglePlay()"
          class="audioplayer-controls-toggleplay"
          :class="{ pause: playing, play: !playing }"
        ></button>
        <audioplayer-track
          :percentage="percentagePlayed"
          @seek="seekToPercentage"
          class="w-full"
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
