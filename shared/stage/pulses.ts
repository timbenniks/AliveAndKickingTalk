import { frameDecay } from './clock.ts'

export const LANE_BINS = [
  [1, 4],
  [4, 10],
  [10, 20],
  [20, 40],
  [40, 64],
  [64, 110],
] as const

export type LaneBins = ReadonlyArray<readonly [number, number]>

// Six log-spaced pitch zones over a guitar's fundamental range. This is not
// string detection (mono audio cannot tell strings apart), only low to high.
export function guitarLaneBins(sampleRate: number, fftSize: number, low = 80, high = 1300): LaneBins {
  const hz = sampleRate / fftSize
  const step = Math.pow(high / low, 1 / 6)
  return Array.from({ length: 6 }, (_, lane) => {
    const from = Math.floor(low * Math.pow(step, lane) / hz)
    const to = Math.max(from + 1, Math.floor(low * Math.pow(step, lane + 1) / hz))
    return [from, to] as const
  })
}

export function bandLevels(freq: ArrayLike<number>, bins: LaneBins = LANE_BINS): number[] {
  return bins.map(([from, to]) => {
    const start = Math.max(0, from)
    const end = Math.min(freq.length, to)
    if (end <= start) return 0
    let sum = 0
    for (let i = start; i < end; i++) sum += freq[i] ?? 0
    return sum / (end - start) / 255
  })
}

// Loudest bin per zone. A note is a narrow peak; averaging a wide zone hides it.
export function peakLevels(freq: ArrayLike<number>, bins: LaneBins): number[] {
  return bins.map(([from, to]) => {
    let peak = 0
    for (let i = Math.max(0, from); i < Math.min(freq.length, to); i++) peak = Math.max(peak, freq[i] ?? 0)
    return peak / 255
  })
}

export function risingLanes(current: number[], baseline: number[], now: number, lastAt: number[], cooldown = 0.13, delta = 1 / 60): number[] {
  const hit: number[] = []
  const keep = frameDecay(0.86, delta)
  for (let lane = 0; lane < current.length; lane++) {
    const value = current[lane] ?? 0
    const base = baseline[lane] ?? 0
    if (value > 0.2 && value > base + 0.07 && now - (lastAt[lane] ?? -10) >= cooldown) hit.push(lane)
    baseline[lane] = base * keep + value * (1 - keep)
  }
  return hit.sort((a, b) => (current[b] ?? 0) - (current[a] ?? 0)).slice(0, 3)
}
