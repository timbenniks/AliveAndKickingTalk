<script setup lang="ts">
import type { LaneSource } from "#shared/stage/types";

// The Rig settings that stick between songs: what feeds the lanes, timing,
// motion and quality. Shared by the Rig drawer and /config.
const props = defineProps<{
  // The drawer passes motion reduced by the OS too; /config shows the toggle alone.
  reduced?: boolean;
}>();

const stage = useStageAudio();
const { forceReduced, lowQuality } = useRigDisplay();
const reducedNow = computed(() => props.reduced ?? forceReduced.value);

const sources: Array<{ id: LaneSource; label: string }> = [
  { id: "song", label: "Backing track" },
  { id: "guitar", label: "Guitar input" },
  { id: "midi", label: "MIDI pickup" },
];

function chooseSource(id: LaneSource) {
  stage.setLaneSource(id);
  if (id === "guitar") void stage.startGuitar();
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
    <PixelButton variant="secondary" :aria-pressed="reducedNow" @click="forceReduced = !forceReduced">{{ reducedNow ? 'Motion reduced' : 'Reduce motion' }}</PixelButton>
    <PixelButton variant="secondary" :aria-pressed="lowQuality" @click="lowQuality = !lowQuality">{{ lowQuality ? 'Low quality' : 'High quality' }}</PixelButton>
  </div>
</template>

<style>
.rig-sources { display: grid; gap: 0.25rem; border: 0; padding: 0; margin: 0; }
.rig-source { display: flex; gap: 0.5rem; align-items: center; font-size: 1.05rem; cursor: pointer; }
.rig-source input { accent-color: var(--color-gold); }
.rig-toggles { display: flex; flex-wrap: wrap; gap: 0.75rem; }
</style>
