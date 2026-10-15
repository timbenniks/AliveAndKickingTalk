// Pitch ranges, shared with converted MIDI. A mono cable cannot identify the
// physical string when the same pitch can be played in several positions.
const LANE_STARTS = [40, 45, 50, 55, 59, 64];
export function guitarPitchLane(pitch: number) {
  return Math.max(0, LANE_STARTS.findLastIndex(start => pitch >= start));
}

export function guitarNoteName(pitch: number) {
  return `${['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}
