<script setup lang="ts">
import { Carousel, Navigation, Pagination, Slide } from "vue3-carousel";
import { storeToRefs } from "pinia";

const songStore = useSongStore();

const { allSongs, votedAmount, maxVotes, voting } = storeToRefs(songStore);
const songsCarousel = ref();
const background = ref(allSongs.value[0].artwork[0]);
const handleSlideStart = (data: any) => {
  background.value = allSongs.value[data?.slidingToIndex || 0].artwork[0];
};

const pagination = ref();
watch(votedAmount, () => {
  const result: any = [];
  const items = pagination?.value.querySelectorAll("li");

  allSongs.value.forEach((song, index) => {
    if (song.voted) {
      result.push(index);
    }
  });

  [...items].forEach((node) => {
    node.classList.remove("voted");
  });

  result.forEach((song: number) => {
    items[song].classList.add("voted");
  });
});
</script>

<template>
  <main>
    <Transition>
      <div
        class="bg-cover w-screen h-screen absolute top-0 left-0 z-0"
        :key="background.bg"
        :style="{
          backgroundImage: `url(${background.bg})`,
          backgroundPositionX: background.x,
        }"
      ></div>
    </Transition>
    <article
      class="w-11/12 md:w-[600px] m-auto text-center relative z-10 mt-4 md:mt-8"
    >
      <h1 class="text-3xl md:text-5xl font-black uppercase md:mb-2">
        UPVOTE SONGS
        <span class="text-sm">({{ votedAmount }}/{{ maxVotes }})</span>
      </h1>
    </article>
    <Carousel
      ref="songsCarousel"
      @slide-start="handleSlideStart"
      class="mt-[90px] md:mt-36"
    >
      <template #addons="{ slidesCount, currentSlide }">
        <Navigation />

        <div
          ref="pagination"
          class="absolute -top-20 left-2/4 -translate-x-2/4 w-80 md:w-96 fancy-image flex p-2"
        >
          <p class="flowing-title text-4xl font-black mr-3">
            {{ currentSlide + 1 }}/{{ slidesCount }}
          </p>
          <Pagination />
        </div>
      </template>

      <Slide v-for="song in allSongs" :key="song.songId">
        <div class="carousel__item w-80 md:w-96">
          <figure class="mb-4">
            <figcaption class="block text-left mb-4">
              <span class="block uppercase font-black text-2xl">{{
                song.song
              }}</span>
              <span class="block uppercase font-light text-2xl">{{
                song.artist
              }}</span>
            </figcaption>

            <img
              :src="
                song.cover.replace('q_auto,f_auto', 'q_auto,f_auto,w_380,h_380')
              "
              :alt="`${song.artist} ${song.song}`"
              width="384"
              height="384"
            />
          </figure>

          <div class="flex space-x-4 mb-4">
            <button
              class="flex space-x-2 justify-center"
              @click="
                !song.voted && votedAmount < maxVotes
                  ? songStore.upvote(song.songId)
                  : songStore.downvote(song.songId)
              "
              :disabled="voting || (!song.voted && votedAmount >= maxVotes)"
              :class="{
                'cta-fancy !pointer-events-none': voting,
                'cta-fancy': !song.voted && votedAmount < maxVotes,
                'cta-negative !pointer-events-none':
                  !song.voted && votedAmount >= maxVotes,
                cta: song.voted,
              }"
            >
              <span class="mt-[3px] text-md">
                <template v-if="!song.voted && votedAmount < maxVotes"
                  >VOTE FOR THIS</template
                >
                <template v-if="!song.voted && votedAmount >= maxVotes"
                  >NO MORE VOTES</template
                >
                <template v-if="song.voted">REMOVE VOTE</template>

                <span class="text-xs pl-2"
                  >({{ votedAmount }}/{{ maxVotes }})</span
                >
              </span>
            </button>

            <loader class="relative top-2" v-show="voting" />
          </div>
          <SongShare
            copy="SHARE ON"
            nativecopy="SHARE YOUR VOTE"
            :song="song"
            v-if="song.voted"
            :mashup="false"
          />
        </div>
      </Slide>
    </Carousel>
  </main>
</template>

<style lang="postcss">
.v-enter-active,
.v-leave-active {
  transition: opacity 1s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}

.carousel {
  position: relative;
  text-align: center;
  box-sizing: border-box;
}

.carousel * {
  box-sizing: border-box;
}

.carousel__track {
  display: flex;
  margin: 0;
  padding: 0;
  position: relative;
}

.carousel__viewport {
  overflow: hidden;
}

.carousel__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.carousel__slide {
  scroll-snap-stop: auto;
  flex-shrink: 0;
  margin: 0;
  position: relative;

  display: flex;
  justify-content: center;
  align-items: center;

  /* Fix iOS scrolling #22 */
  transform: translateZ(0);
}

.carousel__icon {
  @apply w-8 h-8 md:w-32 md:h-32;
  fill: currentColor;
}

.carousel__prev,
.carousel__next {
  @apply w-8 h-8 md:w-32 md:h-32;
  box-sizing: content-box;
  text-align: center;
  font-size: 2rem;
  padding: 0;
  color: #fff;
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  border: 0;
  cursor: pointer;
  margin: 0 10px;
  top: 50%;
  transform: translateY(-50%);
}

.carousel__prev:hover,
.carousel__next:hover {
  color: #ddd;
}

.carousel__next--disabled,
.carousel__prev--disabled {
  opacity: 0.1;
  pointer-events: none;
}

.carousel__prev {
  @apply -left-3 md:left-1/4;
}

.carousel__next {
  @apply -right-3 md:right-1/4;
}

.carousel__pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  list-style: none;
  line-height: 0;
}

.carousel__pagination-button {
  display: block;
  border: 0;
  margin: 0;
  cursor: pointer;
  padding: 0 0.7rem;
  background: transparent;
}

.carousel__pagination-button::after {
  display: block;
  content: "";
  width: 1rem;
  height: 1rem;
  border-radius: 100%;
  background-color: rgba(255, 255, 255, 0.6);
}

.carousel__pagination-button:hover::after,
.carousel__pagination-button--active::after {
  background-color: #fff;
}

.carousel__pagination-item.voted .carousel__pagination-button::after {
  border-radius: 100%;
  background: linear-gradient(89.87deg, #256ad1 7.57%, #d1258c 95.58%)
    border-box;
}
</style>
