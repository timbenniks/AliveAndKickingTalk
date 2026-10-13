<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ChapterMark } from '#shared/stage/timeline'
import { formatTime } from '#shared/stage/timeline'
import { lookFor } from '#shared/stage/themes'
import { stageClock } from '#shared/stage/clock'

const props = defineProps<{
  marks: ChapterMark[]
  duration: number
}>()

const emit = defineEmits<{ seek: [seconds: number] }>()

const root = ref<HTMLElement | null>(null)
const activeId = ref('')
const nextId = ref('')

const kind = computed(() => props.marks[0]?.kind ?? 'amp')
const active = computed(() => props.marks.find(mark => mark.id === activeId.value))

function color(theme: string) {
  return lookFor(theme).primary
}

function render(time: number) {
  const current = [...props.marks].reverse().find(mark => mark.at <= time + 0.001)
  const next = props.marks.find(mark => mark.at > time + 0.05)
  const currentId = current?.id ?? ''
  const followingId = next?.id ?? ''
  if (currentId !== activeId.value) activeId.value = currentId
  if (followingId !== nextId.value) nextId.value = followingId
  const card = root.value?.querySelector<HTMLElement>('.on')
  if (card && current) {
    const end = next?.at ?? props.duration
    const span = Math.max(0.001, end - current.at)
    const fill = Math.min(100, Math.max(0, ((time - current.at) / span) * 100))
    card.style.setProperty('--fill', `${fill}%`)
  }
  const lamp = stageClock.analysis === 'live' && stageClock.playing ? stageClock.energy : 0.12
  root.value?.style.setProperty('--lamp', lamp.toFixed(3))
}

onMounted(() => render(stageClock.time))

defineExpose({ render })
</script>

<template>
  <section ref="root" class="chapters" :aria-label="kind === 'section' ? 'Sections' : 'Amp cues'">
    <ol class="chapter-list">
      <li v-for="mark in marks" :key="mark.id">
        <button
          type="button"
          :class="{ on: mark.id === activeId, soon: mark.id === nextId, past: active && mark.at < active.at }"
          :style="{ '--mark': color(mark.theme) }"
          :aria-current="mark.id === activeId ? 'true' : undefined"
          @click="emit('seek', mark.at)"
        >
          <span class="voxel-lamps" aria-hidden="true"><i v-for="lamp in 4" :key="lamp" /></span>
          <span class="voxel-block">
            <span class="voxel-cap" aria-hidden="true"><i v-for="cell in 8" :key="cell" /></span>
            <span class="voxel-side" aria-hidden="true"><i v-for="cell in 3" :key="cell" /></span>
            <span class="voxel-body">
              <span class="mark-time">{{ formatTime(mark.at) }}</span>
              <span class="mark-name">{{ mark.label }}</span>
              <span class="mark-detail">{{ mark.detail }}</span>
            </span>
            <span class="voxel-base" aria-hidden="true"><i v-for="cell in 8" :key="cell" /></span>
          </span>
        </button>
      </li>
    </ol>
  </section>
</template>

<style>
.chapters {
  position: absolute;
  top: 43%;
  left: 0;
  right: 0;
  display: grid;
  gap: 8px;
  width: min(1080px, 100%);
  margin: 0 auto;
  transform: translateY(-100%);
  justify-items: center;
  pointer-events: auto;
  perspective: 900px;
}





.chapter-list {
  display: flex;
  justify-content: center;
  gap: 18px;
  width: 100%;
  margin: 0;
  padding: 18px 12px 8px;
  overflow: visible;
  list-style: none;
}

.chapter-list li { flex: 1 1 0; min-width: 140px; max-width: 240px; }

.chapter-list button {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: center;
  cursor: pointer;
  transform: rotateX(16deg) rotateY(-8deg);
  transform-origin: center bottom;
}

.chapter-list button:hover { transform: rotateX(10deg) rotateY(-4deg) translateY(2px); }

.voxel-lamps {
  display: grid;
  grid-template-columns: repeat(4, 16px);
  justify-content: space-between;
  height: 18px;
  margin: 0 8px 8px;
}

.voxel-lamps i {
  position: relative;
  display: block;
  background: linear-gradient(#4a4044 0 4px, #161014 4px 14px, #070305 14px);
  box-shadow: 2px 3px 0 #050203;
}

.voxel-lamps i::before {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 10px;
  height: 6px;
  background: var(--mark);
  box-shadow: 0 0 12px var(--mark);
  opacity: calc(0.35 + var(--lamp, 0.12));
}

.voxel-lamps i::after {
  content: "";
  position: absolute;
  top: 16px;
  left: 2px;
  width: 12px;
  height: 36px;
  background: linear-gradient(var(--mark), transparent);
  opacity: calc(0.12 + var(--lamp, 0.12) * 0.55);
  pointer-events: none;
}

.chapter-list button.on .voxel-lamps i::before {
  opacity: 1;
}

.voxel-block {
  display: grid;
  grid-template-columns: 1fr 14px;
  gap: 3px;
}

.voxel-cap,
.voxel-base {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 3px;
}

.voxel-cap { grid-column: 1; grid-row: 1; height: 16px; }

.voxel-cap i,
.voxel-side i,
.voxel-base i { display: block; }

.voxel-cap i {
  background:
    linear-gradient(
      to bottom,
      color-mix(in srgb, var(--mark) 74%, white) 0 5px,
      var(--mark) 5px 11px,
      color-mix(in srgb, var(--mark) 28%, black) 11px
    );
  box-shadow: 2px 3px 0 color-mix(in srgb, var(--mark) 20%, #050203);
}

.voxel-side {
  display: grid;
  grid-column: 2;
  grid-row: 1 / span 2;
  gap: 3px;
  margin-top: 8px;
}

.voxel-side i {
  background: linear-gradient(to bottom, #4a3038 0 4px, #1a0e12 4px 70%, #070305 70%);
  box-shadow: 2px 2px 0 #050203;
}

.voxel-body {
  display: grid;
  gap: 2px;
  grid-column: 1;
  grid-row: 2;
  padding: 8px 8px 6px;
  background-color: #14080c;
  background-image:
    linear-gradient(#6a4048, #6a4048),
    repeating-linear-gradient(to right, transparent 0 16px, #0c0608 16px 19px),
    repeating-linear-gradient(to bottom, #321820 0 11px, #10080c 11px 14px);
  background-size: 100% 5px, 100% 100%, 100% 14px;
  background-repeat: no-repeat, repeat, repeat;
  background-position: 0 0, 0 5px, 0 5px;
}

.voxel-base {
  grid-column: 1 / span 2;
  grid-row: 3;
  height: 8px;
  margin-left: 8px;
}

.voxel-base i {
  background: linear-gradient(to bottom, #2c181e 0 3px, #0c0608 3px);
  box-shadow: 0 3px 0 #050203;
}

.chapter-list button.on .voxel-body {
  background-image:
    linear-gradient(#7a4c56, #7a4c56),
    repeating-linear-gradient(to right, transparent 0 16px, #0c0608 16px 19px),
    repeating-linear-gradient(to bottom, #3c1c26 0 11px, #14080e 11px 14px);
}

.chapter-list button.on .voxel-body::after {
  content: "";
  height: 4px;
  width: var(--fill, 0%);
  justify-self: start;
  background: repeating-linear-gradient(to right, var(--color-gold) 0 4px, #b88a12 4px 5px);
  box-shadow: 0 2px 0 #4a3606;
}

.chapter-list button.soon .voxel-cap {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--mark) 70%, white);
}

.chapter-list button.past { opacity: 0.5; }

.mark-time { color: var(--mark); font-family: var(--font-pixel); font-size: 16px; }

.mark-name {
  overflow: hidden;
  font-family: var(--font-pixel);
  font-size: 22px;
  line-height: 1;
  letter-spacing: 0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mark-detail { color: var(--color-dust); font-family: var(--font-caps); font-size: 9px; text-transform: uppercase; }

.mark-name { color: var(--color-bone); }
.chapter-list button { text-decoration: none; }

@media (max-width: 700px) {
  .chapter-list { gap: 8px; padding-inline: 8px; }
  .chapter-list li { min-width: 0; }
  .voxel-lamps, .voxel-side, .mark-detail { display: none; }
  .voxel-block { grid-template-columns: 1fr; }
}
</style>
