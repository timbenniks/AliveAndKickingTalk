<script setup lang="ts">
import { stageClock } from "#shared/stage/clock";
import { emitMoment } from "#shared/stage/moments";

// The Rig drawer: the settings that stick (StageRigSetup), show moments, the crowd,
// and (dev) a vote simulator and a signal readout.
const props = defineProps<{
  live?: boolean;
  host?: boolean;
  reduced: boolean;
  themeId: string;
  // Live screen: phone taps and the encore vote.
  show?: ReturnType<typeof useStageShow> | null;
}>();
const emit = defineEmits<{ simulateVote: [] }>();

const stage = useStageAudio();
const isDev = import.meta.dev;

// Show moments Tim can fire by hand.
const moments = [
  { label: "Pyro", moment: { kind: "pyro" } },
  { label: "Confetti", moment: { kind: "confetti" } },
  { label: "Crowd surf", moment: { kind: "surf" } },
  { label: "Pit jump", moment: { kind: "jump" } },
  { label: "Replay intro", moment: { kind: "intro" } },
] as const;

const encore = computed(() => props.show?.encoreState.value ?? null);
const encoreOpen = computed(() => !!encore.value && !encore.value.result);

const debugText = ref<HTMLElement | null>(null);
const signalOpen = ref(false);
stage.onTick(() => {
  if (!signalOpen.value || !debugText.value) return;
  debugText.value.textContent = `lanes ${stageClock.lanes.map(l => l.toFixed(2)).join(" ")}\nenergy ${stageClock.energy.toFixed(2)} · ${stageClock.analysis}\ntheme ${props.themeId}`;
});

// Dev only: fire any show moment from the console, e.g.
// __emitMoment({ kind: 'title', lines: ['Encore!'], seconds: 4 })
if (isDev) {
  onMounted(() => { (window as unknown as { __emitMoment: typeof emitMoment }).__emitMoment = emitMoment; });
  onUnmounted(() => { delete (window as unknown as { __emitMoment?: typeof emitMoment }).__emitMoment; });
}
</script>

<template>
  <StageRigSetup :reduced="reduced" />
  <fieldset class="rig-show">
    <legend class="rig-field"><span>Show</span></legend>
    <PixelButton v-for="item in moments" :key="item.label" variant="secondary" @click="emitMoment(item.moment)">{{ item.label }}</PixelButton>
  </fieldset>
  <fieldset v-if="show" class="rig-show">
    <legend class="rig-field"><span>Crowd · {{ show.audience.value }} {{ show.audience.value === 1 ? 'phone' : 'phones' }} connected</span></legend>
    <p v-if="host && show.phaseError.value" role="status" class="rig-status">Show updates could not reach phones. Retrying…</p>
    <PixelButton v-if="host" :disabled="encoreOpen" @click="show.openEncore()">Open encore vote (15 s)</PixelButton>
    <PixelButton v-if="isDev" variant="secondary" :disabled="encoreOpen" @click="show.openEncore(15, true)">Local encore vote (dev)</PixelButton>
    <p v-if="encore" role="status" class="rig-status">
      <template v-if="encoreOpen">{{ encore.taps }} of {{ encore.threshold }} fans in · {{ Math.ceil(encore.remainingMs / 1000) }} s left</template>
      <template v-else-if="encore.result === 'won'">The room wants an encore.</template>
      <template v-else>Not enough fans joined in this time.</template>
    </p>
    <PixelButton v-if="show.encoreLink.value" :to="show.encoreLink.value">Play encore: {{ show.encoreTitle.value }}</PixelButton>
  </fieldset>
  <PixelButton v-if="isDev && live" variant="secondary" @click="emit('simulateVote')">Simulate a vote</PixelButton>
  <details class="rig-debug" @toggle="signalOpen = ($event.target as HTMLDetailsElement).open">
    <summary class="rig-field"><span>Signal</span></summary>
    <pre ref="debugText" />
  </details>
</template>

<style>
.rig-show { display: flex; flex-wrap: wrap; gap: 0.75rem; border: 0; padding: 0; margin: 0; }
.rig-show legend { margin-bottom: 0.5rem; }
.rig-debug pre { font-family: var(--font-caps); font-size: 0.65rem; white-space: pre-wrap; color: var(--color-dust); margin-top: 0.5rem; }
</style>
