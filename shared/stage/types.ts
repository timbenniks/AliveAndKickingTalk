import type { Song } from '../types/song.ts'

export type StageSong = Pick<Song, 'songId' | 'presets'>

export interface StageCue {
  id: string
  at: number
  type: 'preset' | 'visual'
  theme?: string
  style?: string
  presetName?: string
  programChange?: number
}

export interface StageSection {
  id: string
  start: number
  end: number
  title: string
  theme?: string
  style?: string
}

export type AnalysisState = 'idle' | 'live' | 'unavailable'

export type LaneSource = 'song' | 'guitar' | 'midi'

export interface StagePulse {
  lane: number
  strength: number
  note?: number
}

export interface PlayedNote {
  note: number
  strength: number
  startedAt: number
}

// A voter in the mosh pit.
export interface Fan {
  userid: string
  avatar: string
  songId: string
}
