import type { PlayedNote } from './types.ts';

// Pitch ranges for the polyphonic guitar detector. A mono cable cannot identify the
// physical string when the same pitch can be played in several positions.
const LANE_STARTS = [40, 45, 50, 55, 59, 64];
export function guitarPitchLane(pitch: number) {
  return Math.max(0, LANE_STARTS.findLastIndex(start => pitch >= start));
}

export function guitarNoteName(pitch: number) {
  return `${['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

// Merge unison MIDI channels for display without losing other pitches in a lane.
// Retain the original attack time until that pitch is released or struck again.
export function updatePlayedNotes(previous: PlayedNote[], notes: Array<{ note: number; strength: number }>, now: number, attacks: number[] = []): PlayedNote[] {
  const pitches = new Map<number, number>();
  for (const { note, strength } of notes) pitches.set(note, Math.max(pitches.get(note) ?? 0, strength));
  return [...pitches].sort(([a], [b]) => a - b).map(([note, strength]) => ({
    note, strength,
    startedAt: attacks.includes(note) ? now : previous.find(n => n.note === note)?.startedAt ?? now,
  }));
}

// One springy launch, then a steady raised gem. No fake vibration/bending.
export function noteGemPose(age: number, strength: number, reducedMotion: boolean) {
  const power = Math.max(0, Math.min(1, strength));
  const t = Math.max(0, age);
  const bounce = reducedMotion ? 0 : Math.sin(Math.min(1, t / 0.3) * Math.PI) * Math.exp(-t * 3);
  return { lift: reducedMotion ? 0.12 : 0.18 + power * 0.12 + bounce * 0.32, scale: 1.35 + power * 0.45 + bounce * 0.35 };
}
