<script setup lang="ts">
import { Carousel, Navigation, Pagination, Slide } from "vue3-carousel";
import { storeToRefs } from "pinia";

const songStore = useSongStore();

const { allSongs, votedAmount, maxVotes, voting } = storeToRefs(songStore);

const background = ref(allSongs.value[0]?.artwork[0] || { bg: '', x: '50%' });
const handleSlideStart = (data: { slidingToIndex: number }) => {
  background.value = allSongs.value[data.slidingToIndex]?.artwork[0] || background.value;
};

// Fret colors mark the songs you voted for: one color per song, in setlist order.
const fretFor = (index: number) => (index % 6) + 1;

const pagination = useTemplateRef<HTMLElement>('pagination');
watchEffect(() => {
  const items = pagination.value?.querySelectorAll('li');
  items?.forEach((node, index) => node.classList.toggle('voted', !!allSongs.value[index]?.voted));
});
</script>

<template>
  <main class="vote-page">
    <Transition name="vote-bg">
      <div
        :key="background.bg"
        class="vote-bg"
        :style="{
          backgroundImage: `url(${background.bg})`,
          backgroundPositionX: background.x,
        }"
      />
    </Transition>

    <header class="vote-head">
      <p class="vote-eyebrow">Alive and Kicking: Rock Anthem Edition</p>
      <h1 class="vote-title">Vote for the next anthem</h1>
      <p class="vote-count" aria-live="polite">
        <PixelBadge>{{ votedAmount }} of {{ maxVotes }} votes used</PixelBadge>
      </p>
    </header>

    <Carousel class="vote-carousel" @slide-start="handleSlideStart">
      <template #addons="{ slidesCount, currentSlide }">
        <Navigation />

        <div ref="pagination" class="vote-pager">
          <p class="vote-pager-count">{{ currentSlide + 1 }}/{{ slidesCount }}</p>
          <Pagination />
        </div>
      </template>

      <Slide v-for="(song, index) in allSongs" :key="song.songId">
        <PixelPanel class="vote-card" tag="article" :fret="song.voted ? fretFor(index) : 0">
          <img
            class="vote-cover"
            :src="song.cover.replace('q_auto,f_auto', 'q_auto,f_auto,w_380,h_380')"
            :alt="`${song.song} by ${song.artist}, cover`"
            width="384"
            height="384"
          >
          <div class="vote-copy">
            <h2 class="vote-song">{{ song.song }}</h2>
            <p class="vote-artist">{{ song.artist }}</p>
            <PixelBadge v-if="song.voted" :fret="fretFor(index)">Your vote</PixelBadge>
          </div>

          <div class="vote-actions">
            <PixelButton
              :variant="song.voted ? 'secondary' : 'primary'"
              :disabled="voting || (!song.voted && votedAmount >= maxVotes)"
              @click="
                !song.voted && votedAmount < maxVotes
                  ? songStore.upvote(song.songId)
                  : songStore.downvote(song.songId)
              "
            >
              <template v-if="song.voted">Remove vote</template>
              <template v-else-if="votedAmount >= maxVotes">No votes left</template>
              <template v-else>Vote for this song</template>
            </PixelButton>
            <loader v-show="voting" />
            <SongShare v-if="song.voted" nativecopy="Share" :song="song" :mashup="false" />
          </div>
          <p v-if="!song.voted && votedAmount >= maxVotes" class="vote-hint">
            Remove a vote from another song to pick this one.
          </p>
        </PixelPanel>
      </Slide>
    </Carousel>
  </main>
</template>

<style>
.vote-page {
  position: relative;
  min-height: 100dvh;
  overflow: hidden;
  padding: 1.25rem 0 3rem;
  background: var(--color-night);
  color: var(--color-bone);
  font-family: var(--font-sans);
}
.vote-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-size: cover;
  opacity: 0.32;
}
.vote-bg::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, color-mix(in srgb, var(--color-night) 40%, transparent), var(--color-night) 85%);
}
.vote-bg-enter-active, .vote-bg-leave-active { transition: opacity 0.6s steps(6); }
.vote-bg-enter-from, .vote-bg-leave-to { opacity: 0; }

.vote-head {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  padding: 0 1rem;
  text-align: center;
}
.vote-eyebrow { font-family: var(--font-caps); font-size: 0.65rem; text-transform: uppercase; color: var(--color-gold); }
.vote-title { font-family: var(--font-pixel); font-weight: 400; font-size: clamp(2.5rem, 9vw, 4rem); line-height: 0.9; }

.vote-carousel { position: relative; z-index: 1; margin-top: 5.5rem; text-align: center; }
.vote-carousel * { box-sizing: border-box; }

.vote-card {
  width: min(22rem, calc(100vw - 7.25rem));
  display: grid;
  gap: 0.875rem;
  justify-items: start;
  text-align: left;
}
.vote-cover { width: 100%; height: auto; aspect-ratio: 1; object-fit: cover; box-shadow: var(--px) var(--px) 0 var(--color-ink); }
.vote-copy { display: grid; gap: 0.25rem; justify-items: start; }
.vote-song { font-family: var(--font-pixel); font-weight: 400; font-size: 2rem; line-height: 0.95; }
.vote-artist { color: var(--color-dust); font-size: 1.1rem; }
.vote-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; }
.vote-hint { color: var(--color-dust); font-size: 0.95rem; }

/* vue3-carousel structure, restyled. */
.carousel__track { display: flex; margin: 0; padding: 0; position: relative; }
.carousel__viewport { overflow: hidden; padding-block: 0.5rem 1rem; }
.carousel__sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); border: 0;
}
.carousel__slide {
  scroll-snap-stop: auto;
  flex-shrink: 0;
  margin: 0;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  /* Fix iOS scrolling #22 */
  transform: translateZ(0);
}
.carousel__icon { width: 1.75rem; height: 1.75rem; fill: currentColor; }
.carousel__prev,
.carousel__next {
  position: absolute;
  top: 40%;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 0;
  margin: 0;
  background: var(--color-tolex);
  color: var(--color-bone);
  box-shadow: var(--px) var(--px) 0 var(--color-ink);
  cursor: pointer;
  text-decoration: none;
  transform: translateY(-50%);
}
.carousel__prev:hover, .carousel__next:hover { color: var(--color-gold); }
.carousel__prev:focus-visible, .carousel__next:focus-visible,
.carousel__pagination-button:focus-visible { outline: var(--px) solid var(--color-fret-4); outline-offset: var(--px); }
.carousel__next--disabled, .carousel__prev--disabled { opacity: 0.2; pointer-events: none; }
.carousel__prev { left: 0.25rem; }
.carousel__next { right: 0.25rem; }

.vote-pager {
  position: absolute;
  top: -4.25rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: max-content;
  max-width: calc(100vw - 2rem);
  padding: 0.375rem 0.75rem;
  background: color-mix(in srgb, var(--color-night) 80%, transparent);
  box-shadow: var(--px) var(--px) 0 var(--color-ink);
}
.vote-pager-count { font-family: var(--font-pixel); font-size: 1.75rem; line-height: 1; color: var(--color-gold); white-space: nowrap; }
.carousel__pagination { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 0.25rem; list-style: none; margin: 0; padding: 0; line-height: 0; }
.carousel__pagination-button { display: block; border: 0; margin: 0; padding: 0.2rem; background: transparent; cursor: pointer; text-decoration: none; }
.carousel__pagination-button::after {
  display: block;
  content: "";
  width: calc(var(--px) * 2);
  height: calc(var(--px) * 2);
  background: var(--color-tolex-hi);
}
.carousel__pagination-button:hover::after,
.carousel__pagination-button--active::after { background: var(--color-bone); }
/* Songs you voted for light up gold in the pager. */
.carousel__pagination-item.voted .carousel__pagination-button::after { background: var(--color-gold); }

@media (min-width: 48rem) {
  .vote-carousel { margin-top: 6rem; }
  .carousel__prev { left: calc(50% - 16rem); }
  .carousel__next { right: calc(50% - 16rem); }
  .carousel__prev, .carousel__next { width: 3.5rem; height: 3.5rem; }
}
@media (prefers-reduced-motion: reduce) {
  .vote-bg-enter-active, .vote-bg-leave-active { transition: none; }
}
</style>
