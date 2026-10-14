import type { Song } from '~/types';
import { stageClock } from '#shared/stage/clock';
import { emitMoment, onMoment } from '#shared/stage/moments';

// The song intro: the camera flies in from behind the pit (CameraRig reads
// stageClock.introAt) while the band and song light up the LED wall. Plays on
// load and again whenever an 'intro' moment fires (the Rig's Replay intro).
export function useStageIntro(song: () => Song) {
  function start() {
    stageClock.introAt = performance.now() / 1000;
    emitMoment({ kind: 'title', lines: [song().artist, song().song], seconds: 5 });
  }
  const stop = onMoment((moment) => { if (moment.kind === 'intro') start(); });
  onMounted(start);
  onUnmounted(() => {
    stop();
    stageClock.introAt = 0;
  });
}
