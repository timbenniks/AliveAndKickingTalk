<script setup lang="ts">
import type { LaneSource } from "#shared/stage/types";

// The Rig settings that stick between songs: what feeds the lanes, timing,
// motion and quality. Shared by the Rig drawer and /config.
const props = defineProps<{
  // The drawer passes motion reduced by the OS too; /config shows the toggle alone.
  reduced?: boolean;
}>();

const stage = useStageAudio();
const { forceReduced, lowQuality, showGuitarNotes } = useRigDisplay();
const reducedNow = computed(() => props.reduced ?? forceReduced.value);

const sources: Array<{ id: LaneSource; label: string }> = [
  { id: "song", label: "Track" },
  { id: "guitar", label: "Guitar" },
  { id: "midi", label: "Guitar MIDI" },
];

function chooseSource(id: LaneSource) {
  stage.setLaneSource(id);
  if (id === "guitar") void stage.startGuitar();
}
</script>

<template>
  <fieldset class="rig-sources">
    <legend class="rig-field"><span>Neck follows</span></legend>
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
    <label class="rig-field">
      <span>Guitar detection</span>
      <select :value="stage.guitarMode.value" @change="stage.setGuitarMode(($event.target as HTMLSelectElement).value as 'spectrum' | 'polyphonic')">
        <option value="spectrum">Spectrum · responsive visuals</option>
        <option value="polyphonic">Polyphonic notes · experimental</option>
      </select>
    </label>
    <template v-if="stage.guitarMode.value === 'polyphonic'">
      <p class="rig-status">Use a clean guitar signal. Lanes follow pitch ranges, not physical strings. Dense chords may miss notes or show extra octaves.</p>
      <label class="rig-field">
        <span>Noise gate {{ stage.guitarGateDb.value }} dB</span>
        <input v-model.number="stage.guitarGateDb.value" type="range" min="-85" max="-30" step="1">
      </label>
      <label class="rig-field">
        <span>Octave filtering</span>
        <select :value="stage.guitarOctaveRatio.value" @change="stage.guitarOctaveRatio.value = Number(($event.target as HTMLSelectElement).value)">
          <option :value="0.65">Balanced</option>
          <option :value="0.85">Strong · fewer extra octaves</option>
          <option :value="0">Off · keep quieter octave voices</option>
        </select>
      </label>
      <p class="rig-status">For extra octave notes, try Strong. Filtering can hide a quieter note in a real octave pair.</p>
      <label class="rig-field">
        <span>Tuning {{ stage.guitarTuningCents.value > 0 ? '+' : '' }}{{ stage.guitarTuningCents.value }} cents</span>
        <input v-model.number="stage.guitarTuningCents.value" type="range" min="-50" max="50" step="1">
      </label>
      <PixelButton variant="secondary" :aria-pressed="showGuitarNotes" @click="showGuitarNotes = !showGuitarNotes">{{ showGuitarNotes ? 'Hide note names' : 'Show note names' }}</PixelButton>
      <p class="rig-status">Signal {{ stage.guitarInputDb.value }} dB · {{ stage.guitarInputDb.value < stage.guitarGateDb.value ? 'below gate' : 'above gate' }}</p>
      <p role="status" class="rig-status">Detected: {{ stage.guitarNotes.value || '—' }} · {{ stage.guitarDetectionMs.value }} ms per analysis</p>
      <p class="rig-status">Raise the gate until idle noise stops triggering; lower it if quiet notes disappear. Tune to A440 or adjust the tuning above.</p>
    </template>
    <p v-else class="rig-status">Lanes follow low-to-high audio energy, including chords and harmonics.</p>
    <PixelButton variant="secondary" @click="stage.startGuitar()">Listen to guitar</PixelButton>
  </template>
  <template v-if="stage.laneSource.value === 'midi'">
    <label class="rig-field">
      <span>Note input</span>
      <select :value="stage.midiInput.inputId.value" @change="stage.midiInput.selectInput(($event.target as HTMLSelectElement).value)">
        <option value="">Select a MIDI input</option>
        <option v-for="input in stage.midiInput.inputs.value" :key="input.id" :value="input.id">{{ input.name }}</option>
      </select>
    </label>
    <p role="status" class="rig-status">{{ stage.midiInput.status.value }}</p>
    <p class="rig-status">Start Alive Guitar MIDI with your clean guitar input, then select its port here. Lanes follow pitch ranges, not physical strings.</p>
    <p role="status" class="rig-status">Detected: {{ stage.midiNotes.value || '—' }}</p>
    <PixelButton variant="secondary" @click="stage.midiInput.connect()">Reconnect MIDI</PixelButton>
    <PixelButton variant="secondary" :aria-pressed="showGuitarNotes" @click="showGuitarNotes = !showGuitarNotes">{{ showGuitarNotes ? 'Hide note names' : 'Show note names' }}</PixelButton>
  </template>
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
