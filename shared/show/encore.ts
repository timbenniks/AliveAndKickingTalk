import type { PlayedSong, Song } from '../types/song.ts'

// The encore vote: for a short window every phone can tap once (repeat taps
// from the same voter count once). Win when enough of the room joined in.

export type EncoreResult = 'won' | 'lost' | null
export type EncoreState = { taps: number; threshold: number; progress: number; remainingMs: number; result: EncoreResult }

export function encoreThreshold(audience: number) {
  return Math.max(3, Math.ceil(0.35 * audience))
}

export function createEncoreWindow({ endsAt, audience }: { endsAt: number; audience: number }) {
  const voters = new Set<string>()
  let room = audience
  let result: EncoreResult = null

  return {
    tap(uid: string, now: number) {
      if (now < endsAt && result === null) voters.add(uid)
    },
    setAudience(n: number) {
      room = n
    },
    state(now: number): EncoreState {
      const threshold = encoreThreshold(room)
      if (result === null && now >= endsAt) result = voters.size >= threshold ? 'won' : 'lost'
      return {
        taps: voters.size,
        threshold,
        progress: Math.min(1, voters.size / threshold),
        remainingMs: Math.max(0, endsAt - now),
        result,
      }
    },
  }
}

// The encore is the top-voted song not played yet; ties keep setlist order.
export function pickEncoreSong(songs: Pick<Song, 'songId' | 'votes'>[], played: Pick<PlayedSong, 'songId'>[]) {
  const done = new Set(played.map(song => song.songId))
  let best: Pick<Song, 'songId' | 'votes'> | null = null
  for (const song of songs) {
    if (!done.has(song.songId) && (!best || song.votes > best.votes)) best = song
  }
  return best?.songId ?? null
}
