export const GUITAR_TUNINGS = {
  standard: { label: 'Standard · E A D G B E', notes: [40, 45, 50, 55, 59, 64] },
  dropD: { label: 'Drop D · D A D G B E', notes: [38, 45, 50, 55, 59, 64] },
  halfDown: { label: 'Half step down · E♭ A♭ D♭ G♭ B♭ E♭', notes: [39, 44, 49, 54, 58, 63] },
  wholeDown: { label: 'Whole step down · D G C F A D', notes: [38, 43, 48, 53, 57, 62] },
} as const
export type GuitarTuning = keyof typeof GUITAR_TUNINGS

export function guitarNoteName(midi: number) {
  const note = Math.round(midi)
  return `${['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1}`
}

// ponytail: pitch cannot identify overlapping string ranges; per-string MIDI
// is the upgrade when physical string identity matters. Prefer a low fret;
// during a phrase, prefer nearby positions and keep small bends on the string.
export function estimateGuitarString(midi: number, tuning: GuitarTuning, previousLane = -1, previousMidi = 0) {
  const notes = GUITAR_TUNINGS[tuning].notes
  let lane = -1
  let best = Infinity
  for (let i = 0; i < notes.length; i++) {
    const fret = midi - notes[i]!
    if (fret < -0.55 || fret > 24.5) continue
    let score = Math.max(0, fret) * 0.3
    if (previousLane >= 0) {
      const previousFret = previousMidi - notes[previousLane]!
      score += Math.abs(fret - previousFret) * 0.35 + Math.abs(i - previousLane) * 0.65
      if (i === previousLane && Math.abs(midi - previousMidi) < 2.5) score -= 1.5
    }
    if (score < best) { best = score; lane = i }
  }
  return lane
}

// One reusable workspace, no per-tick arrays. YIN runs on ~12kHz averaged
// samples over the latest 60ms; the short envelope separately finds new picks.
export class GuitarDetector {
  readonly fftSize: number
  private readonly stride: number
  private readonly rate: number
  private readonly samples: Float32Array
  private readonly difference: Float32Array
  private envelope = 0
  private previousRms = 0
  private pendingUntil = -1
  private lastHit = -1
  private lastAttack = -1
  private lastVoiced = -1
  private lastTime = -1
  private candidate = -1
  private confirmations = 0
  private phraseMidi = 0
  readonly result = { lane: -1, midi: 0, confidence: 0, level: 0, hit: false }

  constructor(sampleRate: number) {
    this.fftSize = Math.max(4096, 2 ** Math.ceil(Math.log2(sampleRate * 0.06)))
    this.stride = Math.max(1, Math.round(sampleRate / 12000))
    this.rate = sampleRate / this.stride
    this.samples = new Float32Array(Math.floor(sampleRate * 0.06 / this.stride))
    this.difference = new Float32Array(Math.ceil(this.rate / 60) + 2)
  }

  reset() {
    this.envelope = this.previousRms = 0
    this.pendingUntil = this.lastHit = this.lastAttack = this.lastVoiced = this.lastTime = -1
    this.candidate = -1
    this.confirmations = this.phraseMidi = 0
    Object.assign(this.result, { lane: -1, midi: 0, confidence: 0, level: 0, hit: false })
  }

  read(frame: Float32Array, now: number, tuning: GuitarTuning = 'standard', gateDb = -65) {
    const result = this.result
    result.hit = false
    // Bound CPU use independently of the display's refresh rate.
    if (now - this.lastTime < 1 / 60 - 0.0001) return result
    const delta = this.lastTime < 0 ? 1 / 60 : Math.min(0.1, now - this.lastTime)
    this.lastTime = now
    let energy = 0
    const shortLength = Math.min(frame.length, this.stride * 192)
    for (let i = frame.length - shortLength; i < frame.length; i++) energy += frame[i]! ** 2
    const rms = Math.sqrt(energy / shortLength)
    const gate = 10 ** (gateDb / 20)
    const oldEnvelope = this.envelope
    this.envelope += (rms - this.envelope) * (1 - Math.exp(-delta / 0.07))
    const attack = this.previousRms < gate || (rms > this.previousRms * 1.35 && rms > Math.max(gate, oldEnvelope) * 1.3)
    this.previousRms = rms
    if (rms >= gate && attack && now - this.lastAttack >= 0.045) {
      this.pendingUntil = now + 0.1
      this.lastAttack = now
    }
    result.level = rms >= gate ? Math.min(1, Math.max(0.25, (20 * Math.log10(rms) - gateDb) / 35)) : 0
    if (rms < gate) {
      result.confidence = 0
      this.confirmations = 0
      if (now - this.lastVoiced > 0.18) { result.lane = -1; this.phraseMidi = 0 }
      return result
    }

    // Shorten the initial window so pre-pick silence does not delay tracking;
    // expand back to 60ms for stable sustain and lower-note discrimination.
    const count = Math.min(this.samples.length, Math.max(Math.ceil(this.rate * 0.035), Math.ceil((now - this.lastAttack) * this.rate)))
    const start = frame.length - count * this.stride
    for (let i = 0; i < count; i++) {
      let sum = 0
      for (let j = 0; j < this.stride; j++) sum += frame[start + i * this.stride + j]!
      this.samples[i] = sum / this.stride
    }
    const minLag = Math.max(2, Math.floor(this.rate / 1400))
    const maxLag = Math.min(this.difference.length - 2, Math.floor(this.rate / 60), Math.floor(count / 2))
    const window = count - maxLag
    let cumulative = 0
    let lag = -1
    this.difference[0] = 1
    for (let tau = 1; tau <= maxLag; tau++) {
      let sum = 0
      for (let i = 0; i < window; i++) {
        const difference = this.samples[i]! - this.samples[i + tau]!
        sum += difference * difference
      }
      cumulative += sum
      this.difference[tau] = cumulative > 0 ? sum * tau / cumulative : 1
      // First sufficiently periodic valley, not the largest spectral peak:
      // higher harmonics must not generate their own notes or extra lanes.
      if (tau > minLag && this.difference[tau - 1]! < 0.12 && this.difference[tau]! >= this.difference[tau - 1]!) {
        lag = tau - 1
        break
      }
    }
    if (lag < 0) { result.confidence = 0; this.confirmations = 0; return result }
    const left = this.difference[lag - 1]!
    const center = this.difference[lag]!
    const right = this.difference[lag + 1]!
    const curvature = left - 2 * center + right
    let refined = lag + (curvature ? Math.max(-0.5, Math.min(0.5, (left - right) / (2 * curvature))) : 0)
    // A very strong second harmonic can satisfy YIN one octave too early.
    // Verify actual energy at the lower fundamental, rather than blindly
    // doubling a periodic interval (which would also halve every pure note).
    if (refined * 2 <= maxLag && this.hasLowerFundamental(refined, count)) refined *= 2
    const midi = 69 + 12 * Math.log2(this.rate / refined / 440)
    result.confidence = 1 - center
    const rounded = Math.round(midi)
    if (rounded === this.candidate) this.confirmations++
    else { this.candidate = rounded; this.confirmations = 1 }
    // Two readings reject the unstable pitch at the very start of a pick.
    if (this.confirmations < 2) return result
    const previousLane = now - this.lastVoiced < 0.35 ? result.lane : -1
    const lane = estimateGuitarString(midi, tuning, previousLane, this.phraseMidi)
    if (lane < 0) { result.confidence = 0; return result }
    const changed = Math.abs(midi - result.midi) >= 0.8
    result.lane = lane
    result.midi = midi
    this.phraseMidi = midi
    this.lastVoiced = now
    if ((now <= this.pendingUntil || changed) && now - this.lastHit >= 0.045) {
      result.hit = true
      this.lastHit = now
      this.pendingUntil = -1
    }
    return result
  }

  private hasLowerFundamental(period: number, count: number) {
    const primary = 2 * Math.cos(2 * Math.PI / period)
    const lower = 2 * Math.cos(Math.PI / period)
    let p1 = 0, p2 = 0, l1 = 0, l2 = 0
    for (let i = 0; i < count; i++) {
      // Hann window suppresses leakage from the strong upper harmonic.
      const value = this.samples[i]! * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (count - 1)))
      const p = value + primary * p1 - p2
      const l = value + lower * l1 - l2
      p2 = p1; p1 = p; l2 = l1; l1 = l
    }
    const primaryPower = p1 * p1 + p2 * p2 - primary * p1 * p2
    const lowerPower = l1 * l1 + l2 * l2 - lower * l1 * l2
    return primaryPower > 0 && lowerPower > primaryPower * 0.0064
  }
}
