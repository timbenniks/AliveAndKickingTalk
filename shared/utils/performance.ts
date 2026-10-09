import type { AmpPreset, PlayedSong, Song } from '../types/song.ts'

export function presetAtTime(presets: AmpPreset[], time: number): AmpPreset | undefined {
  return presets.reduce<AmpPreset | undefined>((selected, preset) =>
    preset.at <= time && (!selected || preset.at >= selected.at) ? preset : selected, undefined)
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
