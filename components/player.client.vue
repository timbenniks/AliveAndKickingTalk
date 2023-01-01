<script lang="ts" setup>
// https://github.com/WebDevSimplified/Guitar-Amp/blob/master/script.js

const time = ref(0);

type eventReturn = {
  event: Event;
  setPlaying: Function;
  setMuted: Function;
};

function onPlayerPlay({ event, setPlaying }: eventReturn) {
  console.log(event.type);
  setPlaying(true);
}

function onPlayerPause({ event, setPlaying }: eventReturn) {
  console.log(event.type);
  setPlaying(false);
}

function onPlayerEnded({ event, setPlaying }: eventReturn) {
  console.log(event.type);
  setPlaying(false);
}

function onPlayerLoadeddata({ event }: eventReturn) {
  console.log(event.type);
}

function onPlayerWaiting({ event }: eventReturn) {
  console.log(event.type);
}

function onPlayerPlaying({ event }: eventReturn) {
  console.log(event.type);
}

function onPlayerTimeupdate({ event }: eventReturn) {
  time.value = (event.target as HTMLAudioElement).currentTime;
  // console.log({
  //   event: event.type,
  //   time: (event.target as HTMLAudioElement).currentTime,
  // });
}

function onPlayerCanplay({ event }: eventReturn) {
  console.log(event.type);
}

function onPlayerCanplaythrough({ event }: eventReturn) {
  console.log(event.type);
}

function playerStateChanged({ event }: eventReturn) {
  console.log(event.type);
}
</script>

<template>
  <audioplayer
    class="audioplayer"
    src="/johnny_b_goode.mp3"
    :muted="false"
    :autoplay="false"
    :controls="true"
    :loop="false"
    @play="onPlayerPlay"
    @pause="onPlayerPause"
    @ended="onPlayerEnded"
    @loadeddata="onPlayerLoadeddata"
    @waiting="onPlayerWaiting"
    @playing="onPlayerPlaying"
    @timeupdate="onPlayerTimeupdate"
    @canplay="onPlayerCanplay"
    @canplaythrough="onPlayerCanplaythrough"
    @statechanged="playerStateChanged"
  >
    <template
      v-slot:controls="{
        togglePlay,
        playing,
        percentagePlayed,
        seekToPercentage,
        duration,
        convertTimeToDuration,
      }"
    >
      <div
        class="audioplayer-controls bg-black fixed justify-between h-20 bottom-0 left-0 flex w-screen space-x-8"
      >
        <button @click="togglePlay()" class="audioplayer-controls-toggleplay">
          {{ playing ? "pause" : "play" }}
        </button>
        <audioplayer-track
          :percentage="percentagePlayed"
          @seek="seekToPercentage"
          class="audioplayer-controls-track"
        />
        <div class="audioplayer-controls-time">
          {{ convertTimeToDuration(time) }} /
          {{ convertTimeToDuration(duration) }}
        </div>
      </div>
      <audioplayer-visualizer />
    </template>
  </audioplayer>
</template>
