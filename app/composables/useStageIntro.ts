import type { Song } from '~/types';
import { INTRO_SECONDS, stageClock } from '#shared/stage/clock';
import { emitMoment, onMoment } from '#shared/stage/moments';

// The song intro: the camera flies in from behind the pit (CameraRig reads
// stageClock.introAt) while the band and song light up the LED wall. Plays on
// load and again whenever an 'intro' moment fires (the Rig's Replay intro).
// `flying` is true while the camera is still far off, so screen-fixed HUD
// pieces (the amp boards) can wait until the stage is in frame.
export function useStageIntro(song: () => Song) {
  const flying = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  function start() {
    stageClock.introAt = performance.now() / 1000;
    emitMoment({ kind: 'title', lines: [song().artist, song().song], seconds: 5 });
    if (stageClock.reducedMotion) return;
    flying.value = true;
    clearTimeout(timer);
    timer = setTimeout(() => { flying.value = false; }, INTRO_SECONDS * 0.8 * 1000);
  }
  const stop = onMoment((moment) => { if (moment.kind === 'intro') start(); });
  onMounted(start);
  onUnmounted(() => {
    stop();
    clearTimeout(timer);
    stageClock.introAt = 0;
  });
  return { flying };
}
