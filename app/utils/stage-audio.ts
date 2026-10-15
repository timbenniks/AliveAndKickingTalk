import { ref, shallowRef, watch } from 'vue';
import { readPreference as read, writePreference as write } from './preferences.ts';
import { GuitarPolyDetector } from '#shared/stage/guitar-poly';
import { guitarNoteName } from '#shared/stage/guitar-notes';
import { frameDecay, stageClock } from '#shared/stage/clock';
import { bandLevels, guitarLaneBins, peakLevels, risingLanes, type LaneBins } from '#shared/stage/pulses';
import type { AnalysisState, LaneSource } from '#shared/stage/types';

export function createStageAudio() {
  // Browser audio engine. Nuxt owns the instance; components acquire/release it.
  // The backing track drives effects; the chosen input drives neck pulses.

  const SOURCE_KEY = 'alive-lane-source';
  const DEVICE_KEY = 'alive-guitar-input';
  const OFFSET_KEY = 'alive-visual-offset';

  const laneSource = ref<LaneSource>('song');
  const offsetMs = ref(0);
  const guitarDevices = shallowRef<MediaDeviceInfo[]>([]);
  const guitarDeviceId = ref('');
  const guitarStatus = ref('Guitar input is off');
  const guitarMode = ref<'spectrum' | 'polyphonic'>('spectrum');
  const guitarGateDb = ref(-65);
  const guitarTuningCents = ref(0);
  const guitarOctaveRatio = ref(0.65);
  const guitarNotes = ref('');
  const guitarInputDb = ref(-120);
  const guitarDetectionMs = ref(0);
  let polyDetector: GuitarPolyDetector | null = null;
  let polyFreq = new Float32Array(0);
  let lastPolyFrame = -10;
  let polyTimer: ReturnType<typeof setInterval> | undefined;
  let lastDiagnostics = -10;

  let context: AudioContext | null = null;
  let songElement: HTMLAudioElement | null = null;
  let songSource: MediaElementAudioSourceNode | null = null;
  let songAnalyser: AnalyserNode | null = null;
  let songPulses: AnalyserNode | null = null;
  let guitarStream: MediaStream | null = null;
  let guitarSource: MediaStreamAudioSourceNode | null = null;
  let guitarAnalyser: AnalyserNode | null = null;
  let guitarRequest = 0;
  let guitarBins: LaneBins = [];
  let songFreq = new Uint8Array(0);
  let pulseFreq = new Uint8Array(0);
  let guitarFreq = new Uint8Array(0);
  let raf = 0;
  let users = 0;
  const tickHandlers = new Set<() => void>();
  let heardSignal = false;
  let lastWall = 0;
  const baseline = [0, 0, 0, 0, 0, 0];
  const lastHit = [-10, -10, -10, -10, -10, -10];

  function resetGuitarDetection() {
    clearInterval(polyTimer);
    polyTimer = undefined;
    if (context && guitarAnalyser) {
      // Keep the same analysis duration on interfaces running at 44.1–192 kHz.
      guitarAnalyser.fftSize = guitarMode.value === 'polyphonic'
        ? Math.min(16384, Math.max(2048, 2 ** Math.round(Math.log2(context.sampleRate * 4096 / 48000)))) : 4096;
      polyFreq = new Float32Array(guitarAnalyser.frequencyBinCount);
      guitarFreq = new Uint8Array(guitarAnalyser.frequencyBinCount);
      guitarBins = guitarLaneBins(context.sampleRate, guitarAnalyser.fftSize);
    }
    polyDetector = context && guitarAnalyser && guitarMode.value === 'polyphonic'
      ? new GuitarPolyDetector(context.sampleRate, guitarAnalyser.fftSize, guitarTuningCents.value) : null;
    if (polyDetector) polyTimer = setInterval(analyseGuitar, 1000 / 60);
    if (guitarAnalyser) guitarAnalyser.smoothingTimeConstant = guitarMode.value === 'polyphonic' ? 0 : 0.3;
    lastPolyFrame = -10;
    lastDiagnostics = -10;
    guitarNotes.value = '';
    guitarInputDb.value = -120;
    guitarDetectionMs.value = 0;
    baseline.fill(0);
    lastHit.fill(-10);
    if (laneSource.value === 'guitar') {
      stageClock.lanes.fill(0);
      stageClock.events.length = 0;
    }
  }

  // Native FFT on a separate timer: drawing can slow down without reducing
  // analysis to the display rate. Audio time prevents repeated/suspended data
  // from confirming a note. No catch-up burst after a stalled main thread.
  function analyseGuitar() {
    if (!users || laneSource.value !== 'guitar' || !context || context.state !== 'running' || !guitarAnalyser || !polyDetector) return;
    const now = context.currentTime;
    if (now - lastPolyFrame < 1 / 90) return;
    lastPolyFrame = now;
    guitarAnalyser.getFloatFrequencyData(polyFreq);
    const started = performance.now();
    const detected = polyDetector.process(polyFreq, now, guitarGateDb.value, guitarOctaveRatio.value);
    const elapsed = performance.now() - started;
    for (let lane = 0; lane < 6; lane++) stageClock.lanes[lane] = detected.levels[lane] ?? 0;
    stageClock.events.push(...detected.hits);
    if (stageClock.events.length > 64) stageClock.events.splice(0, stageClock.events.length - 64);
    if (now - lastDiagnostics >= 0.1) {
      lastDiagnostics = now;
      guitarInputDb.value = Math.round(detected.inputDb);
      guitarNotes.value = detected.notes.map(guitarNoteName).join(' · ');
      guitarDetectionMs.value = Math.round(elapsed * 10) / 10;
    }
  }

  function setGuitarMode(mode: 'spectrum' | 'polyphonic') {
    if (mode !== 'spectrum' && mode !== 'polyphonic') return;
    guitarMode.value = mode;
    write('alive-guitar-mode', mode);
    resetGuitarDetection();
  }

  function smooth(current: number, next: number, delta: number) {
    const keep = frameDecay(0.82, delta);
    return current * keep + next * (1 - keep);
  }

  function band(data: Uint8Array, from: number, to: number) {
    const end = Math.min(data.length, to);
    if (end <= from) return 0;
    let sum = 0;
    for (let i = from; i < end; i++) sum += data[i] ?? 0;
    return sum / (end - from) / 255;
  }

  function setAnalysis(state: AnalysisState) {
    stageClock.analysis = state;
  }

  function ensureContext() {
    if (context) return context;
    if (!window.AudioContext) { setAnalysis('unavailable'); return null; }
    context = new AudioContext();
    return context;
  }

  function analyser(ctx: AudioContext, fftSize: number, smoothing: number) {
    const node = ctx.createAnalyser();
    node.fftSize = fftSize;
    node.smoothingTimeConstant = smoothing;
    return node;
  }

  // Called from a user gesture (play). Routes the song through the context once.
  async function connectSong(element: HTMLAudioElement) {
    songElement = element;
    const ctx = ensureContext();
    if (!ctx) return;
    if (songSource && songSource.mediaElement !== element) {
      songSource.disconnect();
      songAnalyser?.disconnect();
      songPulses?.disconnect();
      songSource = null;
    }
    if (!songSource) {
      songSource = ctx.createMediaElementSource(element);
      songAnalyser = analyser(ctx, 256, 0.75);
      songPulses = analyser(ctx, 256, 0.28);
      songSource.connect(songAnalyser);
      songSource.connect(songPulses);
      songAnalyser.connect(ctx.destination);
      songFreq = new Uint8Array(songAnalyser.frequencyBinCount);
      pulseFreq = new Uint8Array(songPulses.frequencyBinCount);
    }
    if (ctx.state === 'suspended') await ctx.resume();
  }

  function registerSong(element: HTMLAudioElement) {
    songElement = element;
  }

  async function listGuitarDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      guitarDevices.value = devices.filter(device => device.kind === 'audioinput');
    } catch {
      guitarDevices.value = [];
    }
  }

  function stopGuitar() {
    guitarRequest++;
    guitarStream?.getTracks().forEach(track => track.stop());
    guitarSource?.disconnect();
    guitarAnalyser?.disconnect();
    guitarStream = null;
    guitarSource = null;
    guitarAnalyser = null;
    guitarStatus.value = 'Guitar input is off';
    resetGuitarDetection();
  }

  // Called from a user gesture. The guitar is analysed only, never sent to the
  // speakers, so the amp stays the monitor and nothing feeds back.
  async function startGuitar(deviceId = guitarDeviceId.value) {
    const ctx = ensureContext();
    if (!ctx || !navigator.mediaDevices?.getUserMedia) {
      guitarStatus.value = 'This browser cannot read audio inputs';
      return;
    }
    stopGuitar();
    const request = guitarRequest;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false, noiseSuppression: false, autoGainControl: false,
        },
      });
      if (request !== guitarRequest || ctx !== context) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      guitarStream = stream;
      // Not awaited: after a page load there is no gesture yet, and play resumes it.
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      guitarSource = ctx.createMediaStreamSource(guitarStream);
      guitarAnalyser = analyser(ctx, 4096, 0.3);
      // Keep the narrow window, but include quiet single notes from a DI input.
      guitarAnalyser.minDecibels = -75;
      guitarAnalyser.maxDecibels = -25;
      guitarSource.connect(guitarAnalyser);
      resetGuitarDetection();
      const track = guitarStream.getAudioTracks()[0];
      guitarDeviceId.value = track?.getSettings().deviceId || deviceId;
      write(DEVICE_KEY, guitarDeviceId.value);
      guitarStatus.value = `Listening to ${track?.label || 'the guitar input'}`;
      // Labels are only exposed after permission is granted.
      await listGuitarDevices();
    } catch {
      if (request !== guitarRequest) return;
      stopGuitar();
      guitarStatus.value = 'Guitar input was blocked or is unavailable. Allow microphone access and retry.';
    }
  }

  function setLaneSource(source: LaneSource) {
    laneSource.value = source;
    write(SOURCE_KEY, source);
    heardSignal = false;
    stageClock.lanes.fill(0);
    stageClock.events.length = 0;
    baseline.fill(0);
    lastHit.fill(-10);
    if (source !== 'guitar') stopGuitar();
    setAnalysis('idle');
  }

  function pushAudioHits(levels: number[], now: number, delta: number) {
    for (let i = 0; i < stageClock.lanes.length; i++) stageClock.lanes[i] = levels[i] ?? 0;
    for (const lane of risingLanes(stageClock.lanes, baseline, now, lastHit, 0.13, delta)) {
      lastHit[lane] = now;
      stageClock.events.push({ lane, strength: stageClock.lanes[lane] ?? 0 });
    }
  }

  function tick() {
    const element = songElement;
    const songPlaying = !!element && !element.paused && !element.ended;
    const audioTime = element && Number.isFinite(element.currentTime) ? element.currentTime : 0;
    const guitarLive = laneSource.value === 'guitar' && !!guitarAnalyser;
    // The rule: lanes follow the chosen source; everything else follows the music.
    const pulsing = laneSource.value === 'song' ? songPlaying : guitarLive;

    // Two clocks. `time` is the song position: cues, gates, the amp board and
    // light sweeps stop when the song stops. `flow` only moves the highway
    // pulses, and runs while the lane source is live, so a guitar still flows
    // over a paused track. Wall-clock deltas, capped so a hidden tab cannot jump.
    const wall = performance.now() / 1000;
    const delta = lastWall ? Math.min(0.1, Math.max(0, wall - lastWall)) : 1 / 60;
    if (pulsing && lastWall) stageClock.flow += delta;
    lastWall = wall;
    const now = stageClock.flow;

    stageClock.audioTime = audioTime;
    stageClock.duration = element && Number.isFinite(element.duration) ? element.duration : 0;
    stageClock.time = Math.max(0, audioTime - offsetMs.value / 1000);
    stageClock.playing = songPlaying;
    stageClock.pulsing = pulsing;

    // Lights, camera shake and side effects follow the song only.
    if (songPlaying && songAnalyser) {
      songAnalyser.getByteFrequencyData(songFreq);
      const bass = band(songFreq, 2, 10);
      const mid = band(songFreq, 10, 40);
      const treble = band(songFreq, 40, 90);
      const energy = bass * 0.5 + mid * 0.35 + treble * 0.15;
      stageClock.onset = Math.max(0, energy - stageClock.energy);
      stageClock.bass = smooth(stageClock.bass, bass, delta);
      stageClock.mid = smooth(stageClock.mid, mid, delta);
      stageClock.treble = smooth(stageClock.treble, treble, delta);
      stageClock.energy = smooth(stageClock.energy, energy, delta);
    } else {
      stageClock.bass = smooth(stageClock.bass, 0, delta);
      stageClock.mid = smooth(stageClock.mid, 0, delta);
      stageClock.treble = smooth(stageClock.treble, 0, delta);
      stageClock.energy = smooth(stageClock.energy, 0, delta);
      stageClock.onset = 0;
    }

    if (laneSource.value === 'song' && songPlaying && songPulses) {
      songPulses.getByteFrequencyData(pulseFreq);
      pushAudioHits(bandLevels(pulseFreq), now, delta);
      if (stageClock.energy > 0.04) { heardSignal = true; setAnalysis('live'); }
      else if (audioTime > 3 && !heardSignal) setAnalysis('unavailable');
    } else if (guitarLive && guitarAnalyser) {
      if (guitarMode.value !== 'polyphonic') {
        guitarAnalyser.getByteFrequencyData(guitarFreq);
        pushAudioHits(peakLevels(guitarFreq, guitarBins), now, delta);
      }
      setAnalysis('live');
    } else {
      const keep = frameDecay(0.8, delta);
      for (let i = 0; i < stageClock.lanes.length; i++) stageClock.lanes[i] = (stageClock.lanes[i] ?? 0) * keep;
    }
    // Nobody drained the queue (no stage mounted): keep it bounded.
    if (stageClock.events.length > 64) stageClock.events.splice(0, stageClock.events.length - 64);
    for (const handler of tickHandlers) handler();

    raf = requestAnimationFrame(tick);
  }

  function teardown() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    stopGuitar();
    songSource?.disconnect();
    songAnalyser?.disconnect();
    songPulses?.disconnect();
    if (context && context.state !== 'closed') void context.close();
    context = null;
    songSource = null;
    songAnalyser = null;
    songPulses = null;
    songElement = null;
    heardSignal = false;
    lastWall = 0;
    stageClock.playing = false;
    stageClock.pulsing = false;
    stageClock.lanes.fill(0);
    stageClock.events.length = 0;
    setAnalysis('idle');
  }

  function seek(seconds: number) {
    if (!songElement || !Number.isFinite(seconds)) return;
    const max = Number.isFinite(songElement.duration) ? songElement.duration : seconds;
    songElement.currentTime = Math.min(Math.max(0, seconds), max);
  }

  // Per-frame hook for HUD pieces that follow the clock without Vue reactivity.
  function onTick(handler: () => void) {
    tickHandlers.add(handler);
    return () => { tickHandlers.delete(handler); };
  }

  const stopOffset = watch(offsetMs, value => write(OFFSET_KEY, String(value)));
  const stopGate = watch(guitarGateDb, value => {
    guitarGateDb.value = Number.isFinite(value) ? Math.max(-85, Math.min(-30, value)) : -65;
    write('alive-guitar-gate', String(guitarGateDb.value));
    polyDetector?.reset();
  });
  const stopOctaves = watch(guitarOctaveRatio, value => {
    guitarOctaveRatio.value = [0, 0.65, 0.85].includes(value) ? value : 0.65;
    write('alive-guitar-octave-filter', String(guitarOctaveRatio.value));
    resetGuitarDetection();
  });
  const stopTuning = watch(guitarTuningCents, value => {
    guitarTuningCents.value = Number.isFinite(value) ? Math.max(-50, Math.min(50, value)) : 0;
    write('alive-guitar-tuning', String(guitarTuningCents.value));
    resetGuitarDetection();
  });

  function acquire() {
    if (users++ > 0) return;
    laneSource.value = read<LaneSource>(SOURCE_KEY, ['song', 'guitar']) || 'song';
    guitarDeviceId.value = read(DEVICE_KEY);
    guitarMode.value = read('alive-guitar-mode', ['spectrum', 'polyphonic']) || 'spectrum';
    guitarOctaveRatio.value = Number(read('alive-guitar-octave-filter', ['0', '0.65', '0.85']) || '0.65');
    const savedGate = Number(read('alive-guitar-gate') || -65);
    const savedTuning = Number(read('alive-guitar-tuning') || 0);
    guitarGateDb.value = Number.isFinite(savedGate) ? Math.max(-85, Math.min(-30, savedGate)) : -65;
    guitarTuningCents.value = Number.isFinite(savedTuning) ? Math.max(-50, Math.min(50, savedTuning)) : 0;
    offsetMs.value = Number(read(OFFSET_KEY)) || 0;
    // Songs load as new pages: pick the guitar back up where it was.
    if (laneSource.value === 'guitar') void startGuitar();
    void listGuitarDevices();
    raf = requestAnimationFrame(tick);
  }

  function release() {
    if (users > 0 && --users === 0) teardown();
  }

  function dispose() {
    users = 0;
    teardown();
    stopOffset();
    stopGate();
    stopOctaves();
    stopTuning();
    tickHandlers.clear();
  }

  return {
    laneSource, offsetMs, guitarDevices, guitarDeviceId, guitarStatus,
    guitarMode, guitarGateDb, guitarTuningCents, guitarOctaveRatio, guitarNotes, guitarInputDb, guitarDetectionMs,
    registerSong, connectSong, setLaneSource, setGuitarMode, startGuitar, stopGuitar, onTick, seek,
    acquire, release, dispose,
  };
}
