import type { AmpPreset, PlayedSong, Song } from '../types/song.ts'

export function presetAtTime(presets: AmpPreset[], time: number): AmpPreset | undefined {
  return presets.reduce<AmpPreset | undefined>((selected, preset) =>
    preset.at <= time && (!selected || preset.at >= selected.at) ? preset : selected, undefined) ?? presets[0]
}

export function buildSetlist(songs: Song[], played: PlayedSong[]): Song[] {
  const remaining = songs.filter(song => !played.some(item => item.songId === song.songId))
    .toSorted((a, b) => b.votes - a.votes)
  return Array.from({ length: 4 }, (_, index) => {
    const locked = played.find(song => song.mashupSpot === index + 1)
    const song = locked && songs.find(song => song.songId === locked.songId)
    return song ? { ...song, mashupSpot: index + 1, blocked: true } : remaining.shift()
  }).filter((song): song is Song => !!song)
}

export async function performVote(state: { voting: boolean; errorMessage: string }, action: () => Promise<unknown>): Promise<boolean> {
  if (state.voting) return false;
  state.voting = true;
  state.errorMessage = '';
  try {
    await action();
    return true;
  } catch {
    state.errorMessage = 'Your vote could not be saved. Check your connection and try again.';
    return false;
  } finally {
    state.voting = false;
  }
}

// Votes are shown the moment you tap and saved in the background, one after
// another, so quick taps never get dropped. When the queue drains it resyncs
// once from the database, which also undoes any vote that failed to save.
export function createVoteQueue(handlers: {
  write: (songId: string, on: boolean) => Promise<unknown>
  resync: () => Promise<unknown>
  onError: (error: unknown) => void
  onBusy?: (busy: boolean) => void
}) {
  const pending: Array<{ songId: string; on: boolean }> = []
  let running: Promise<void> | null = null

  async function drain() {
    handlers.onBusy?.(true)
    let failed = false
    do {
      while (pending.length) {
        const { songId, on } = pending.shift()!
        try {
          await handlers.write(songId, on)
        } catch (error) {
          failed = true
          handlers.onError(error)
        }
      }
      try {
        await handlers.resync()
      } catch (error) {
        if (!failed) handlers.onError(error)
      }
      // Taps can arrive while the database snapshot is loading.
    } while (pending.length)
    running = null
    handlers.onBusy?.(false)
  }

  return {
    push(songId: string, on: boolean) {
      pending.push({ songId, on })
      running ??= drain()
      return running
    },
  }
}
