<script setup lang="ts">
import type { LaneSource } from "#shared/stage/types";
import { stageClock } from "#shared/stage/clock";
import { emitMoment } from "#shared/stage/moments";

// The Rig drawer: what feeds the lanes, timing, motion and quality, and (dev)
// a vote simulator and a signal readout.
const props = defineProps<{ live?: boolean; host?: boolean; reduced: boolean; themeId: string }>();
const forceReduced = defineModel<boolean>("forceReduced", { required: true });
const lowQuality = defineModel<boolean>("lowQuality", { required: true });
const emit = defineEmits<{ simulateVote: [] }>();

const stage = useStageAudio();
const isDev = import.meta.dev;

const sources: Array<{ id: LaneSource; label: string }> = [
  { id: "song", label: "Backing track" },
  { id: "guitar", label: "Guitar input" },
  { id: "midi", label: "MIDI pickup" },
];

function chooseSource(id: LaneSource) {
  stage.setLaneSource(id);
  if (id === "guitar") void stage.startGuitar();
}

// Show moments Tim can fire by hand.
const moments = [
  { label: "Pyro", moment: { kind: "pyro" } },
  { label: "Confetti", moment: { kind: "confetti" } },
  { label: "Crowd surf", moment: { kind: "surf" } },
  { label: "Pit jump", moment: { kind: "jump" } },
  { label: "Replay intro", moment: { kind: "intro" } },
] as const;

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
  <fieldset class="rig-sources">
    <legend class="rig-field"><span>Lanes follow</span></legend>
    <label v-for="source in sources" :key="source.id" class="rig-source">
      <input type="radio" name="lane-source" :checked="stage.laneSource.value === source.id" @change="chooseSource(source.id)">
      {{ source.label }}
    </label>
  </fieldset>
  <template v-if="stage.laneSource.value === 'guitar'">
    <label class="rig-field">
      <span>Guitar input</span>
      <select :value="stage.guitarDeviceId.value" @change="stage.startGuitar(($event.target as HTMLSelectElement).value)">
        <option value="">Default input</option>
        <option v-for="device in stage.guitarDevices.value" :key="device.deviceId" :value="device.deviceId">{{ device.label || 'Audio input' }}</option>
      </select>
    </label>
    <p role="status" class="rig-status">{{ stage.guitarStatus.value }}</p>
    <PixelButton variant="secondary" @click="stage.startGuitar()">Listen to guitar</PixelButton>
  </template>
  <p v-if="stage.laneSource.value === 'midi'" class="rig-status">Pick the pickup under Guitar MIDI input. Channels 1 to 6 light lanes 1 to 6.</p>
  <label class="rig-field">
    <span>Visual offset {{ stage.offsetMs.value }} ms</span>
    <input v-model.number="stage.offsetMs.value" type="range" min="-200" max="200" step="5">
  </label>
  <div class="rig-toggles">
    <PixelButton variant="secondary" :aria-pressed="reduced" @click="forceReduced = !forceReduced">{{ reduced ? 'Motion reduced' : 'Reduce motion' }}</PixelButton>
    <PixelButton variant="secondary" :aria-pressed="lowQuality" @click="lowQuality = !lowQuality">{{ lowQuality ? 'Low quality' : 'High quality' }}</PixelButton>
  </div>
  <fieldset class="rig-show">
    <legend class="rig-field"><span>Show</span></legend>
    <PixelButton v-for="item in moments" :key="item.label" variant="secondary" @click="emitMoment(item.moment)">{{ item.label }}</PixelButton>
  </fieldset>
  <PixelButton v-if="isDev && live" variant="secondary" @click="emit('simulateVote')">Simulate a vote</PixelButton>
  <details class="rig-debug" @toggle="signalOpen = ($event.target as HTMLDetailsElement).open">
    <summary class="rig-field"><span>Signal</span></summary>
    <pre ref="debugText" />
  </details>
</template>

<style>
.rig-sources { display: grid; gap: 0.25rem; border: 0; padding: 0; margin: 0; }
.rig-source { display: flex; gap: 0.5rem; align-items: center; font-size: 1.05rem; cursor: pointer; }
.rig-source input { accent-color: var(--color-gold); }
.rig-toggles { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.rig-show { display: flex; flex-wrap: wrap; gap: 0.75rem; border: 0; padding: 0; margin: 0; }
.rig-show legend { margin-bottom: 0.5rem; }
.rig-debug pre { font-family: var(--font-caps); font-size: 0.65rem; white-space: pre-wrap; color: var(--color-dust); margin-top: 0.5rem; }
</style>
