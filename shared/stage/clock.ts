import type { AnalysisState, StagePulse } from './types.ts'

export const HIGHWAY_SPEED = 16
export const BOARD_TILT = -0.36
export const NECK_LENGTH = 24
export const LANE_X = [1.4, 0.84, 0.28, -0.28, -0.84, -1.4] as const
export const LANE_COLORS = ['#3dff45', '#ff2d2d', '#ffe14a', '#3aa6ff', '#ff8c1a', '#d15cff'] as const

export const stageClock = {
  // Song position (pauses with the song).
  time: 0,
  // Highway clock (runs while the song or a live input plays).
  flow: 0,
  audioTime: 0,
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
  // Lane hits from whichever source feeds the lanes. The highway drains this every frame.
  events: [] as StagePulse[],
}
