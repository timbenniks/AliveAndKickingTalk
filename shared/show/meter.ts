// The crowd power meter: taps fill it, it drains on its own, and when it hits
// the top it fires once and cools down before it can fill again.

export type MeterState = { level: number; full: boolean; cooling: boolean }

export function createPowerMeter({ gain = 0.06, decayPerSecond = 0.12, cooldownMs = 20000 } = {}) {
  let level = 0
  let last: number | null = null
  let coolUntil = 0
  let fired = false

  // Linear decay: a quiet room empties a full meter in about 1 / decayPerSecond seconds.
  function decay(now: number) {
    if (last !== null) level = Math.max(0, level - decayPerSecond * Math.max(0, now - last) / 1000)
    last = now
  }

  function state(now: number): MeterState {
    const full = fired
    fired = false
    return { level, full, cooling: now < coolUntil }
  }

  return {
    // One tap from a room of 5 or fewer is worth `gain`; bigger rooms need more taps.
    taps(n: number, audience: number, now: number): MeterState {
      decay(now)
      if (now >= coolUntil && n > 0) {
        level = Math.min(1, level + n * gain / Math.max(audience, 5))
        if (level >= 1) {
          fired = true
          level = 0
          coolUntil = now + cooldownMs
        }
      }
      return state(now)
    },
    tick(now: number): MeterState {
      decay(now)
      return state(now)
    },
  }
}
