export const LANE_BINS = [
  [1, 4],
  [4, 10],
  [10, 20],
  [20, 40],
  [40, 64],
  [64, 110],
] as const

export function bandLevels(freq: ArrayLike<number>): number[] {
  return LANE_BINS.map(([from, to]) => {
    const start = Math.max(0, from)
    const end = Math.min(freq.length, to)
    if (end <= start) return 0
    let sum = 0
    for (let i = start; i < end; i++) sum += freq[i] ?? 0
    return sum / (end - start) / 255
  })
}

export function risingLanes(current: number[], baseline: number[], now: number, lastAt: number[], cooldown = 0.13): number[] {
  const hit: number[] = []
  for (let lane = 0; lane < current.length; lane++) {
    const value = current[lane] ?? 0
    const base = baseline[lane] ?? 0
    if (value > 0.2 && value > base + 0.07 && now - (lastAt[lane] ?? -10) >= cooldown) hit.push(lane)
    baseline[lane] = base * 0.86 + value * 0.14
  }
  return hit.sort((a, b) => (current[b] ?? 0) - (current[a] ?? 0)).slice(0, 3)
}
