import { stageClock } from '#shared/stage/clock';
import { bandLevels, guitarLaneBins, risingLanes, type LaneBins } from '#shared/stage/pulses';
import type { AnalysisState, LaneSource } from '#shared/stage/types';

// One engine per page: one AudioContext, one MediaElementSource for the song
// (an element can only ever have one), and an optional guitar input stream.
// The song is always the clock. The lane source decides what lights the lanes.

const SOURCE_KEY = 'alive-lane-source';
const DEVICE_KEY = 'alive-guitar-input';

const laneSource = ref<LaneSource>('song');
const analysis = ref<AnalysisState>('idle');
const offsetMs = ref(0);
const guitarDevices = shallowRef<MediaDeviceInfo[]>([]);
const guitarDeviceId = ref('');
const guitarStatus = ref('Guitar input is off');

let context: AudioContext | null = null;
let songElement: HTMLAudioElement | null = null;
let songSource: MediaElementAudioSourceNode | null = null;
let songAnalyser: AnalyserNode | null = null;
let songPulses: AnalyserNode | null = null;
let guitarStream: MediaStream | null = null;
let guitarSource: MediaStreamAudioSourceNode | null = null;
let guitarAnalyser: AnalyserNode | null = null;
let guitarBins: LaneBins = [];
let songFreq = new Uint8Array(0);
let pulseFreq = new Uint8Array(0);
let guitarFreq = new Uint8Array(0);
let raf = 0;
let users = 0;
let heardSignal = false;
const baseline = [0, 0, 0, 0, 0, 0];
const lastHit = [-10, -10, -10, -10, -10, -10];

function read<T extends string>(key: string, allowed?: readonly T[]): T | '' {
  try {
    const value = localStorage.getItem(key) || '';
    return (!allowed || allowed.includes(value as T) ? value : '') as T | '';
  } catch { return ''; }
}

function write(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Private mode: settings are per session. */ }
}

function smooth(current: number, next: number) {
  return current * 0.82 + next * 0.18;
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
  if (analysis.value !== state) analysis.value = state;
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
  guitarStream?.getTracks().forEach(track => track.stop());
  guitarSource?.disconnect();
  guitarStream = null;
  guitarSource = null;
  guitarAnalyser = null;
  guitarStatus.value = 'Guitar input is off';
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
  try {
    guitarStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false, noiseSuppression: false, autoGainControl: false,
      },
    });
    if (ctx.state === 'suspended') await ctx.resume();
    guitarSource = ctx.createMediaStreamSource(guitarStream);
    guitarAnalyser = analyser(ctx, 4096, 0.3);
    guitarSource.connect(guitarAnalyser);
    guitarFreq = new Uint8Array(guitarAnalyser.frequencyBinCount);
    guitarBins = guitarLaneBins(ctx.sampleRate, guitarAnalyser.fftSize);
    const track = guitarStream.getAudioTracks()[0];
    guitarDeviceId.value = track?.getSettings().deviceId || deviceId;
    write(DEVICE_KEY, guitarDeviceId.value);
    guitarStatus.value = `Listening to ${track?.label || 'the guitar input'}`;
    // Labels are only exposed after permission is granted.
    await listGuitarDevices();
  } catch {
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
  if (source !== 'guitar') stopGuitar();
  setAnalysis(source === 'midi' ? 'live' : 'idle');
}

// MIDI guitar pickups send one string per channel. Lane = string.
function midiNote(lane: number, velocity: number, on: boolean) {
  if (laneSource.value !== 'midi' || lane < 0 || lane >= stageClock.lanes.length) return;
  stageClock.lanes[lane] = on ? velocity : 0;
  if (on) stageClock.events.push({ lane, strength: velocity });
}

function pushAudioHits(levels: number[], now: number) {
  for (let i = 0; i < stageClock.lanes.length; i++) stageClock.lanes[i] = levels[i] ?? 0;
  for (const lane of risingLanes(stageClock.lanes, baseline, now, lastHit)) {
    lastHit[lane] = now;
    stageClock.events.push({ lane, strength: stageClock.lanes[lane] ?? 0 });
  }
}

function tick() {
  const element = songElement;
  const songPlaying = !!element && !element.paused && !element.ended;
  const audioTime = element && Number.isFinite(element.currentTime) ? element.currentTime : 0;
  const now = songPlaying || !context ? audioTime : context.currentTime;
  const guitarLive = laneSource.value === 'guitar' && !!guitarAnalyser;
  const live = songPlaying || guitarLive || laneSource.value === 'midi';

  stageClock.audioTime = audioTime;
  stageClock.time = Math.max(0, now - offsetMs.value / 1000);
  stageClock.playing = live;

  // Lights and camera follow the band (the song) when it plays, else the guitar.
  const featureAnalyser = songPlaying ? songAnalyser : guitarLive ? guitarAnalyser : null;
  const featureFreq = songPlaying ? songFreq : guitarFreq;
  if (featureAnalyser) {
    featureAnalyser.getByteFrequencyData(featureFreq);
    // Bin ranges are for a 256-point FFT; scale them for the guitar's larger FFT.
    const k = featureFreq.length / 128;
    const bass = band(featureFreq, 2 * k, 10 * k);
    const mid = band(featureFreq, 10 * k, 40 * k);
    const treble = band(featureFreq, 40 * k, 90 * k);
    const energy = bass * 0.5 + mid * 0.35 + treble * 0.15;
    stageClock.onset = Math.max(0, energy - stageClock.energy);
    stageClock.bass = smooth(stageClock.bass, bass);
    stageClock.mid = smooth(stageClock.mid, mid);
    stageClock.treble = smooth(stageClock.treble, treble);
    stageClock.energy = smooth(stageClock.energy, energy);
  } else {
    stageClock.bass = smooth(stageClock.bass, 0);
    stageClock.mid = smooth(stageClock.mid, 0);
    stageClock.treble = smooth(stageClock.treble, 0);
    stageClock.energy = smooth(stageClock.energy, 0);
    stageClock.onset = 0;
  }

  if (laneSource.value === 'song' && songPlaying && songPulses) {
    songPulses.getByteFrequencyData(pulseFreq);
    pushAudioHits(bandLevels(pulseFreq), now);
    if (stageClock.energy > 0.04) { heardSignal = true; setAnalysis('live'); }
    else if (audioTime > 3 && !heardSignal) setAnalysis('unavailable');
  } else if (guitarLive && guitarAnalyser) {
    guitarAnalyser.getByteFrequencyData(guitarFreq);
    pushAudioHits(bandLevels(guitarFreq, guitarBins), now);
    setAnalysis('live');
  } else if (laneSource.value !== 'midi') {
    for (let i = 0; i < stageClock.lanes.length; i++) stageClock.lanes[i] = (stageClock.lanes[i] ?? 0) * 0.8;
  }
  // Nobody drained the queue (no stage mounted): keep it bounded.
  if (stageClock.events.length > 64) stageClock.events.splice(0, stageClock.events.length - 64);

  raf = requestAnimationFrame(tick);
}

function teardown() {
  cancelAnimationFrame(raf);
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
  stageClock.playing = false;
  stageClock.lanes.fill(0);
  stageClock.events.length = 0;
  setAnalysis('idle');
}

export function useStageAudio() {
  onMounted(() => {
    if (users++ > 0) return;
    laneSource.value = read<LaneSource>(SOURCE_KEY, ['song', 'guitar', 'midi']) || 'song';
    guitarDeviceId.value = read(DEVICE_KEY);
    if (laneSource.value === 'midi') setAnalysis('live');
    void listGuitarDevices();
    raf = requestAnimationFrame(tick);
  });
  onUnmounted(() => {
    if (--users === 0) teardown();
  });

  return {
    laneSource, analysis, offsetMs, guitarDevices, guitarDeviceId, guitarStatus,
    registerSong, connectSong, setLaneSource, startGuitar, stopGuitar, midiNote,
  };
}
