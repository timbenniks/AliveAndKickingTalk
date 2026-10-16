import type { AnalysisState, Fan, PlayedNote, StagePulse } from './types.ts'

// Length of the song-intro crane shot, in seconds.
export const INTRO_SECONDS = 6
export const HIGHWAY_SPEED = 16
export const BOARD_TILT = -0.36
export const NECK_LENGTH = 24
export const LANE_X = [1.4, 0.84, 0.28, -0.28, -0.84, -1.4] as const
export const LANE_COLORS = ['#3dff45', '#ff2d2d', '#ffe14a', '#3aa6ff', '#ff8c1a', '#d15cff'] as const

// Scale a per-frame decay to elapsed seconds, preserving its 60fps response.
export function frameDecay(keep: number, delta: number) {
  return Math.pow(keep, Math.max(0, delta) * 60)
}

// Camera, lights and beams enter/leave a solo together over 1.4 seconds.
export function advanceSolo(level: number, solo: boolean, delta: number) {
  if (stageClock.reducedMotion) return 0
  if (!stageClock.playing) return level
  const target = solo ? 1 : 0
  return level + Math.sign(target - level) * Math.min(Math.abs(target - level), Math.max(0, Math.min(delta, 0.1)) / 1.4)
}

export const stageClock = {
  // Song position (pauses with the song).
  time: 0,
  // Highway clock (runs while the song or a live input plays).
  flow: 0,
  audioTime: 0,
  // Length of the loaded song in seconds, 0 until known.
  duration: 0,
  // The song is playing: lights, camera and effects react.
  playing: false,
  // The lane source is live: the highway shows pulses.
  pulsing: false,
  bass: 0,
  mid: 0,
  treble: 0,
  energy: 0,
  onset: 0,
  lanes: [0, 0, 0, 0, 0, 0],
  analysis: 'idle' as AnalysisState,
  reducedMotion: false,
  // Wall-clock second (performance.now() / 1000) the song intro fly-in started; 0 when none.
  introAt: 0,
  // The crowd meter under the truss, 0..1: the power meter, or encore progress.
  meter: 0,
  meterMode: 'power' as 'power' | 'encore',
  // Lane hits from whichever source feeds the lanes. The highway drains this every frame.
  events: [] as StagePulse[],
  // Actual held pitches, independent of the song clock and of lane aggregation.
  notes: [] as PlayedNote[],
  noteReset: 0,
  // Fast runs from the selected note input, independent of authored solo cues.
  soloBurst: 0,
  // New votes waiting to drop into the mosh pit. The crowd drains this.
  arrivals: [] as Fan[],
}
