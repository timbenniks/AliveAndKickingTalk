<script lang="ts" setup>
// https://github.com/WebDevSimplified/Guitar-Amp/blob/master/script.js
import type { Ref, VueElement } from "vue";

const props = defineProps(["song"]);
const time = ref(0);
const vizualizer: Ref<VueElement | null> = ref(null);

type eventReturn = {
  event: Event;
  setPlaying: Function;
  setMuted: Function;
};

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
}

function onPlayerTimeupdate({ event }: eventReturn) {
  time.value = (event.target as HTMLAudioElement).currentTime;
}
</script>

<template>
  <audioplayer
    class="audioplayer"
    :src="props.song.mp3"
    :muted="false"
    :autoplay="false"
    :controls="false"
    :loop="false"
    @play="onPlayerPlay"
    @pause="onPlayerPause"
    @ended="onPlayerEnded"
    @timeupdate="onPlayerTimeupdate"
  >
    <template
      v-slot:controls="{
        togglePlay,
        playing,
        percentagePlayed,
        seekToPercentage,
        convertTimeToDuration,
      }"
    >
      <audioplayer-visualizer
        ref="vizualizer"
        class="absolute bottom-20 w-full"
      />

      <audioplayer-play @bigplay="togglePlay" :playing="playing" />

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
          <!-- {{ convertTimeToDuration(duration) }} -->
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
