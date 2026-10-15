import { guitarPitchLane } from './guitar-notes.ts';

type Atom = { note: number; bins: number[]; weights: number[]; norm: number };
export type GuitarDetection = { inputDb: number; notes: number[]; levels: number[]; hits: Array<{ lane: number; strength: number }> };
const FIRST_NOTE = 38; // D2 through E6, including drop D.
const LAST_NOTE = 88;

// Magnitude response of the browser analyser's Blackman window. Matching the
// spread around each partial helps distinguish a pitch from its adjacent bin.
function windowResponse(offset: number) {
  const sinc = (x: number) => Math.abs(x) < 1e-8 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
  return Math.abs(sinc(offset) + (0.25 / 0.42) * (sinc(offset - 1) + sinc(offset + 1))
    + (0.04 / 0.42) * (sinc(offset - 2) + sinc(offset + 2)));
}

/** Independent, bounded spectral-template fit. No model downloads or audio routing. */
export class GuitarPolyDetector {
  private atoms: Atom[] = [];
  private coefficients: Float32Array;
  private order: Array<{ index: number; score: number }> = [];
  private residual: Float32Array;
  private noiseBins: Float32Array;
  private roots: number[] = [];
  private amplitudes = new Float32Array(LAST_NOTE - FIRST_NOTE + 1);
  private active = new Uint8Array(LAST_NOTE - FIRST_NOTE + 1);
  private seen = new Uint8Array(LAST_NOTE - FIRST_NOTE + 1);
  private lastSeen = new Float64Array(LAST_NOTE - FIRST_NOTE + 1).fill(-10);
  private lastHit = new Float64Array(LAST_NOTE - FIRST_NOTE + 1).fill(-10);
  private previous = new Float32Array(LAST_NOTE - FIRST_NOTE + 1);
  private eligible = new Uint8Array(LAST_NOTE - FIRST_NOTE + 1);
  private lastTime = -10;

  constructor(sampleRate: number, fftSize: number, cents = 0) {
    this.residual = new Float32Array(Math.min(fftSize / 2, Math.ceil(4500 * fftSize / sampleRate)));
    this.noiseBins = new Float32Array(this.residual.length);
    for (let pitch = FIRST_NOTE; pitch <= LAST_NOTE; pitch++) {
      const root = 440 * 2 ** ((pitch - 69 + cents / 100) / 12) * fftSize / sampleRate;
      this.roots.push(root);
      // ponytail: three generic timbres, not a learned guitar model. Recorded
      // guitar evaluation should precede a larger dictionary or learned model.
      for (const rolloff of [0.8, 1.4, 2]) {
        const weights = new Map<number, number>();
        for (let harmonic = 1; harmonic <= 10; harmonic++) {
          const center = root * harmonic;
          if (center + 3 >= this.residual.length) break;
          for (let bin = Math.max(1, Math.ceil(center - 3)); bin <= Math.floor(center + 3); bin++) {
            weights.set(bin, (weights.get(bin) || 0) + windowResponse(bin - center) / harmonic ** rolloff);
          }
        }
        const bins = [...weights.keys()];
        const values = [...weights.values()];
        this.atoms.push({ note: pitch - FIRST_NOTE, bins, weights: values, norm: values.reduce((sum, x) => sum + x * x, 0) });
      }
    }
    this.coefficients = new Float32Array(this.atoms.length);
    this.order = this.atoms.map((_, index) => ({ index, score: 0 }));
  }

  reset() {
    this.active.fill(0);
    this.seen.fill(0);
    this.previous.fill(0);
    this.lastSeen.fill(-10);
    this.lastHit.fill(-10);
    this.lastTime = -10;
  }

  process(decibels: Float32Array, now: number, gateDb = -65, octaveRatio = 0.65): GuitarDetection {
    if (now < this.lastTime || now - this.lastTime > 0.3) this.reset();
    this.lastTime = now;
    let peak = 0;
    let power = 0;
    for (let bin = 0; bin < this.residual.length; bin++) {
      const db = decibels[bin] ?? -Infinity;
      const value = Number.isFinite(db) ? 10 ** (db / 20) : 0;
      this.residual[bin] = value;
      peak = Math.max(peak, value);
      if (bin > 0) power += value * value;
    }
    // Gate the whole signal, not each partial: FFT magnitudes are much lower
    // than input RMS, and a guitar's upper harmonics are quieter still.
    // Parseval, corrected for the Blackman window's mean square (0.3046).
    const inputDb = Math.max(-120, 10 * Math.log10(Math.max(1e-12, 2 * power / 0.3046)));
    const gateOpen = inputDb >= gateDb;
    this.noiseBins.set(this.residual);
    this.noiseBins.sort();
    // Lower-quintile bins estimate broadband noise without treating a chord's
    // strong partials as noise. All matching thresholds now scale with signal.
    const noise = this.noiseBins[Math.floor(this.noiseBins.length * 0.2)]!;
    const floor = Math.max(noise * 2, peak * 0.006);
    for (let bin = 0; bin < this.residual.length; bin++) this.residual[bin] = Math.max(0, this.residual[bin]! - floor);
    for (let note = 0; note < this.roots.length; note++) {
      const root = Math.round(this.roots[note]!);
      const fundamental = Math.max(this.residual[root - 1] || 0, this.residual[root] || 0, this.residual[root + 1] || 0);
      let support = 0;
      for (let harmonic = 2; harmonic <= 8; harmonic++) {
        const expected = this.roots[note]! * harmonic;
        if (expected + 2 >= this.residual.length) break;
        const center = Math.round(expected);
        for (let bin = Math.max(1, center - 1); bin <= center + 1; bin++) {
          const value = this.residual[bin]!;
          if (value <= this.residual[bin - 1]! || value < this.residual[bin + 1]! || value < Math.max(noise * 3, peak * 0.008)) continue;
          const left = decibels[bin - 1]!, middle = decibels[bin]!, right = decibels[bin + 1]!;
          const denominator = left - 2 * middle + right;
          const offset = Number.isFinite(denominator) && denominator !== 0 ? 0.5 * (left - right) / denominator : 0;
          if (Math.abs(bin + Math.max(-0.5, Math.min(0.5, offset)) - expected) < 0.45) { support++; break; }
        }
      }
      this.eligible[note] = Number(gateOpen && fundamental > Math.max(noise * 4, peak * 0.025) && support >= 2);
    }
    this.coefficients.fill(0);
    // Fit the best-supported templates first, so nearby low notes cannot steal
    // the same broad fundamental simply because they came first in MIDI order.
    for (const item of this.order) {
      const atom = this.atoms[item.index]!;
      let dot = 0;
      if (this.eligible[atom.note]) {
        for (let j = 0; j < atom.bins.length; j++) dot += this.residual[atom.bins[j]!]! * atom.weights[j]!;
      }
      item.score = dot / Math.sqrt(atom.norm);
    }
    this.order.sort((a, b) => b.score - a.score);
    // Sparse nonnegative least squares: notes compete to explain the same
    // partials, instead of turning each harmonic peak into another note.
    const penalty = Math.max(noise * 2, peak * 0.018);
    for (let pass = 0; pass < 32; pass++) {
      for (const { index } of this.order) {
        const atom = this.atoms[index]!;
        if (!this.eligible[atom.note]) continue;
        let dot = 0;
        for (let j = 0; j < atom.bins.length; j++) dot += this.residual[atom.bins[j]!]! * atom.weights[j]!;
        const old = this.coefficients[index]!;
        const next = Math.max(0, old + (dot - penalty) / atom.norm);
        const change = next - old;
        this.coefficients[index] = next;
        for (let j = 0; j < atom.bins.length; j++) this.residual[atom.bins[j]!]! -= change * atom.weights[j]!;
      }
    }
    this.amplitudes.fill(0);
    for (let index = 0; index < this.atoms.length; index++) this.amplitudes[this.atoms[index]!.note]! += this.coefficients[index]!;
    const threshold = Math.max(noise * 4, peak * 0.085);
    let candidates = Array.from(this.amplitudes, (amplitude, note) => ({ amplitude, note }))
      .filter(item => item.amplitude > threshold).sort((a, b) => b.amplitude - a.amplitude);
    const strongest = candidates[0];
    // A single pitch family is ambiguous: an unusually strong second partial
    // can fit as a second note. Require octave companions to approach the
    // strongest fitted voice. Mixed-note chords keep their existing fit.
    // ponytail: quiet real octave pairs can also be rejected; disable this
    // preference for octave playing, or replace it with calibrated timbres.
    const ratio = Number.isFinite(octaveRatio) ? Math.max(0, Math.min(1, octaveRatio)) : 0.65;
    if (ratio > 0 && strongest && candidates.every(item => item.note % 12 === strongest.note % 12)) {
      candidates = candidates.filter(item => {
        if (item.amplitude >= strongest.amplitude * ratio) return true;
        // Do not keep a rejected octave visible through release grace.
        this.active[item.note] = 0;
        this.seen[item.note] = 0;
        return false;
      });
    }
    const present = new Set(candidates.slice(0, 6).map(item => item.note));
    const result: GuitarDetection = { inputDb, notes: [], levels: [0, 0, 0, 0, 0, 0], hits: [] };
    const attacks = new Set<number>();
    const strengths = new Float32Array(this.roots.length);
    for (let note = 0; note < this.roots.length; note++) {
      const amplitude = this.amplitudes[note]!;
      if (present.has(note)) {
        this.lastSeen[note] = now;
        this.seen[note] = Math.min(2, this.seen[note]! + 1);
        const attack = this.seen[note]! >= 2 && !this.active[note];
        const restrike = this.active[note] && amplitude > this.previous[note]! * 1.8 && amplitude - this.previous[note]! > threshold;
        if ((attack || restrike) && now - this.lastHit[note]! >= 0.13) {
          attacks.add(note);
          this.lastHit[note] = now;
        }
        if (this.seen[note]! >= 2) this.active[note] = 1;
      } else {
        this.seen[note] = 0;
        if (now - this.lastSeen[note]! > 0.08) this.active[note] = 0;
      }
      strengths[note] = Math.max(amplitude, this.previous[note]!);
      this.previous[note] = amplitude;
    }
    // Release grace must not temporarily turn a six-voice chord change into
    // twelve voices. Prefer currently supported voices, then their amplitude.
    const voices = Array.from(this.active, (active, note) => ({ active, note }))
      .filter(voice => voice.active).sort((a, b) => Number(present.has(b.note)) - Number(present.has(a.note))
        || strengths[b.note]! - strengths[a.note]!);
    for (const { note } of voices.slice(6)) this.active[note] = 0;
    for (const { note } of voices.slice(0, 6).sort((a, b) => a.note - b.note)) {
      const pitch = note + FIRST_NOTE;
      const lane = guitarPitchLane(pitch);
      const strength = this.velocity(strengths[note]!, gateDb);
      result.notes.push(pitch);
      result.levels[lane] = Math.max(result.levels[lane]!, strength);
      if (attacks.has(note)) result.hits.push({ lane, strength });
    }
    return result;
  }

  private velocity(amplitude: number, gateDb: number) {
    return Math.min(1, Math.max(0.25, (20 * Math.log10(Math.max(1e-10, amplitude)) - gateDb) / 35));
  }
}
