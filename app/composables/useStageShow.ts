import { storeToRefs } from 'pinia';
import { stageClock } from '#shared/stage/clock';
import { emitMoment } from '#shared/stage/moments';
import { createTapTally } from '#shared/show/taps';
import { createPowerMeter } from '#shared/show/meter';
import { createEncoreWindow, encoreHref, pickEncoreSong, type EncoreState } from '#shared/show/encore';

// The live screen's side of audience participation: phone taps fill the crowd
// meter while the song plays, and the host can open a 15 second encore vote.
// The host also tells phones what the show is doing (the show_phase row).
// Live screen only; practise has no audience.
export function useStageShow(options: { host: () => boolean; songId: () => string }) {
  const store = useSongStore();
  const { allSongs, allPlayedSongs } = storeToRefs(store);
  const route = useRoute();
  const stage = useStageAudio();
  const channel = useShowChannel('stage');

  const tally = createTapTally(1000, 8);
  const meter = createPowerMeter();
  let encore: ReturnType<typeof createEncoreWindow> | null = null;
  const encoreState = shallowRef<EncoreState | null>(null);
  const encoreSong = ref<string | null>(null);
  let localEncore = false;
  let lastTitle = 0;
  let wasPlaying = false;

  const offTap = channel.on('tap', (uid) => {
    if (!stageClock.playing || encore) return;
    const now = Date.now();
    if (!tally.add(uid, now)) return;
    const state = meter.taps(1, channel.audience.value, now);
    if (state.full) {
      emitMoment({ kind: 'pyro' });
      emitMoment({ kind: 'jump' });
      emitMoment({ kind: 'surf' });
      emitMoment({ kind: 'title', lines: ['ROCK!'], seconds: 3, color: '#ffc531' });
    }
  });
  const offEncore = channel.on('encore', uid => encore?.tap(uid, Date.now()));

  function openEncore(seconds = 15, local = false) {
    const endsAt = Date.now() + seconds * 1000;
    encore = createEncoreWindow({ endsAt, audience: channel.audience.value });
    encoreSong.value = null;
    localEncore = local;
    stageClock.meterMode = 'encore';
    if (options.host() && !local) void store.setShowPhase({ kind: 'encore', endsAt });
  }

  function closeEncore(state: EncoreState) {
    encore = null;
    stageClock.meterMode = 'power';
    if (state.result === 'won') {
      const played = [...allPlayedSongs.value, { songId: options.songId() }];
      encoreSong.value = pickEncoreSong(allSongs.value, played);
      emitMoment({ kind: 'confetti' });
      emitMoment({ kind: 'jump' });
      emitMoment({ kind: 'title', lines: ['ENCORE!'], seconds: 5, color: '#ffc531' });
    } else {
      emitMoment({ kind: 'title', lines: ['MAYBE NEXT TIME'], seconds: 4 });
    }
    wasPlaying = stageClock.playing;
    if (options.host() && !localEncore) void store.setShowPhase({ kind: stageClock.playing ? 'playing' : 'idle' });
  }

  stage.onTick(() => {
    const now = Date.now();
    if (encore) {
      encore.setAudience(channel.audience.value);
      const state = encore.state(now);
      encoreState.value = state;
      stageClock.meter = state.progress;
      // The running count on the LED wall, about four times a second.
      if (state.result) closeEncore(state);
      else if (now - lastTitle > 250) {
        lastTitle = now;
        emitMoment({ kind: 'title', lines: [`ENCORE? ${state.taps}/${state.threshold}`], seconds: 1, color: '#ffc531' });
      }
      return;
    }
    stageClock.meter = meter.tick(now).level;
    // The host keeps phones in step: the meter button shows while the song plays.
    if (options.host() && stageClock.playing !== wasPlaying) {
      wasPlaying = stageClock.playing;
      void store.setShowPhase({ kind: wasPlaying ? 'playing' : 'idle' });
    }
  });

  const encoreLink = computed(() => {
    if (!encoreSong.value) return null;
    const spot = Number(route.query.spot) || undefined;
    return encoreHref(encoreSong.value, spot);
  });
  const encoreTitle = computed(() => allSongs.value.find(song => song.songId === encoreSong.value)?.song ?? '');

  // Dev only: open an encore vote on this screen without touching the database.
  if (import.meta.dev) {
    onMounted(() => { (window as unknown as { __openEncore: typeof openEncore }).__openEncore = (s = 15) => openEncore(s, true); });
  }

  onUnmounted(() => {
    offTap();
    offEncore();
    stageClock.meter = 0;
    stageClock.meterMode = 'power';
    if (import.meta.dev) delete (window as unknown as { __openEncore?: unknown }).__openEncore;
    if (options.host()) void store.setShowPhase({ kind: 'idle' });
  });

  return { audience: channel.audience, encoreState, encoreLink, encoreTitle, openEncore };
}
