import type { Song } from '~/types';
import { stageClock } from '#shared/stage/clock';
import { emitMoment } from '#shared/stage/moments';
import { styleById } from '#shared/stage/styles';
import { lookFor } from '#shared/stage/themes';
import { activeCue, chapterMarks, lengthToSeconds, presetCues } from '#shared/stage/timeline';

// Follows the song through its amp-preset cues: theme and stage style per cue,
// pyro when a solo starts during playback and confetti at the finale.
export function useStageCues(song: () => Song) {
  const stage = useStageAudio();
  const cues = computed(() => presetCues(song()));
  const marks = computed(() => chapterMarks({ cues: cues.value, sections: [] }));
  const duration = computed(() => lengthToSeconds(song().length) ?? 0);
  const theme = shallowRef(lookFor('neon-stadium'));
  const stageStyle = shallowRef(styleById('stadium-smoke'));
  // A solo is a cue styled as one or an amp preset named for one.
  const solo = ref(false);
  let lastCueId = '-';
  let finaleFired = false;

  stage.onTick(() => {
    const cue = activeCue(cues.value, stageClock.time);
    if ((cue?.id ?? '') !== lastCueId) {
      lastCueId = cue?.id ?? '';
      theme.value = lookFor(cue?.theme);
      stageStyle.value = styleById(cue?.style);
      const isSolo = cue?.style === 'solo-flames' || /solo/i.test(cue?.presetName ?? '');
      // Pyro only when a solo starts during playback, not on load or on a seek while paused.
      if (isSolo && !solo.value && stageClock.playing) emitMoment({ kind: 'pyro' });
      solo.value = isSolo;
    }
    // Confetti in the last two seconds; seeking back re-arms it.
    const left = stageClock.duration - stageClock.audioTime;
    if (stageClock.duration && stageClock.playing && left < 2 && !finaleFired) {
      finaleFired = true;
      emitMoment({ kind: 'confetti' });
    } else if (left > 3) finaleFired = false;
  });

  return { marks, duration, theme, stageStyle, solo };
}
