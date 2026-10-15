import { createStageAudio } from '../utils/stage-audio';
import { createMidiOutput } from '../utils/midi-output';
import { createRigDisplay } from '../utils/rig-display';

// A Nuxt app owns the runtime. Hardware starts only when a component acquires
// it; no audio devices, MIDI permissions or browser storage are touched in SSR.
export default defineNuxtPlugin((nuxtApp) => {
  const stageAudio = createStageAudio();
  const midiOutput = createMidiOutput();
  const rigDisplay = createRigDisplay();

  nuxtApp.vueApp.onUnmount(() => {
    stageAudio.dispose();
    midiOutput.dispose();
    rigDisplay.dispose();
  });

  return { provide: { stageAudio, midiOutput, rigDisplay } };
});
