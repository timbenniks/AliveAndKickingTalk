import { guitarPitchLane } from './guitar-notes.ts';

type Peak = { bin: number; amplitude: number };
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
  private coefficients = new Float32Array(0);
  private residual: Float32Array;
  private noiseBins: Float32Array;
  private roots: number[] = [];
  private amplitudes = new Float32Array(LAST_NOTE - FIRST_NOTE + 1);
  private active = new Uint8Array(LAST_NOTE - FIRST_NOTE + 1);
  private seen = new Uint8Array(LAST_NOTE - FIRST_NOTE + 1);
  private lastSeen = new Float64Array(LAST_NOTE - FIRST_NOTE + 1).fill(-10);
  private lastHit = new Float64Array(LAST_NOTE - FIRST_NOTE + 1).fill(-10);
  private previous = new Float32Array(LAST_NOTE - FIRST_NOTE + 1);
  private lastTime = -10;

  constructor(sampleRate: number, fftSize: number, cents = 0) {
    this.residual = new Float32Array(Math.min(fftSize / 2, Math.ceil(4500 * fftSize / sampleRate)));
    this.noiseBins = new Float32Array(this.residual.length);
    for (let pitch = FIRST_NOTE; pitch <= LAST_NOTE; pitch++) {
      this.roots.push(440 * 2 ** ((pitch - 69 + cents / 100) / 12) * fftSize / sampleRate);
    }
  }

  private propose(decibels: Float32Array, noise: number, peak: number) {
    const peaks: Peak[] = [];
    const byBin = new Map<number, Peak>();
    for (let bin = 2; bin < this.residual.length - 1; bin++) {
      const value = this.residual[bin]!;
      if (value < Math.max(noise * 6, peak * 0.008) || value <= this.residual[bin - 1]! || value < this.residual[bin + 1]!) continue;
      const left = decibels[bin - 1]!, middle = decibels[bin]!, right = decibels[bin + 1]!;
      const curvature = left - 2 * middle + right;
      const offset = Number.isFinite(curvature) && curvature !== 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (left - right) / curvature)) : 0;
      const item = { bin: bin + offset, amplitude: value };
      peaks.push(item);
      byBin.set(bin, item);
    }
    const at = (bin: number) => {
      let closest: Peak | undefined;
      for (let i = Math.round(bin) - 1; i <= Math.round(bin) + 1; i++) {
        const p = byBin.get(i);
        if (p && Math.abs(p.bin - bin) < 0.45 && (!closest || Math.abs(p.bin - bin) < Math.abs(closest.bin - bin))) closest = p;
      }
      return closest;
    };
    const proposals = this.roots.map(root => [root]);
    for (const p of peaks) {
      for (let harmonic = 1; harmonic <= 8; harmonic++) {
        const root = p.bin / harmonic;
        const note = Math.round(12 * Math.log2(root / this.roots[0]!));
        if (note >= 0 && note < proposals.length) proposals[note]!.push(root);
      }
    }
    this.atoms = [];
    for (let note = 0; note < proposals.length; note++) {
      let bestRoot = this.roots[note]!;
      let bestScore = 0;
      for (const root of proposals[note]!) {
        let count = 0, score = 0, sum = 0, weight = 0;
        for (let h = 1; h <= 10; h++) {
          const p = at(root * h);
          if (!p) continue;
          count++;
          const strength = Math.sqrt(p.amplitude);
          score += strength / Math.sqrt(h);
          sum += p.bin * strength;
          weight += strength * h;
        }
        if (count < 3 || score <= bestScore) continue;
        const refined = sum / weight;
        if (Math.round(12 * Math.log2(refined / this.roots[0]!)) !== note) continue;
        let aligned = 0, divisor = 0;
        for (let h = 1; h <= 10; h++) {
          const p = at(refined * h);
          if (!p || Math.abs(p.bin - refined * h) >= 0.2) continue;
          aligned++;
          // Relatively prime partial orders prevent inventing an undertone:
          // aligned peaks at 2,4,6 support the octave, not a new lower note.
          let a = divisor, b = h;
          while (b) [a, b] = [b, a % b];
          divisor = a;
        }
        if (aligned < 3 || divisor !== 1) continue;
        bestScore = score;
        bestRoot = refined;
      }
      if (!bestScore) continue;
      // Tiny peak shifts from overlapping notes should not move the entire
      // template. Larger offsets retain their measured continuous frequency.
      if (Math.abs(bestRoot - this.roots[note]!) < 0.025 && Math.abs(1200 * Math.log2(bestRoot / this.roots[note]!)) < 5) bestRoot = this.roots[note]!;
      // ponytail: three smooth timbres plus an optional weak fundamental.
      // Real pickup recordings should justify any larger timbre dictionary.
      const upper = [];
      for (let h = 2; h <= 8; h++) {
        const p = at(bestRoot * h);
        if (p) upper.push(p.amplitude * h ** 1.3);
      }
      upper.sort((a, b) => a - b);
      // Overlapping fundamentals can move or merge a local maximum. Use the
      // nearby energy, not the absence of a perfectly positioned peak, when
      // deciding whether to allow a missing-root timbre.
      const rootBin = Math.round(bestRoot);
      const rootAmplitude = Math.max(this.residual[rootBin - 1] ?? 0, this.residual[rootBin] ?? 0, this.residual[rootBin + 1] ?? 0);
      const weakRoot = rootAmplitude < (upper[Math.floor(upper.length / 2)] ?? 0) * 0.25;
      for (const rolloff of [0.8, 1.4, 2]) {
        for (const rootGain of weakRoot ? [1, 0] : [1]) {
          const weights = new Map<number, number>();
          for (let h = 1; h <= 10; h++) {
            const center = bestRoot * h;
            if (center + 3 >= this.residual.length) break;
            for (let bin = Math.max(1, Math.ceil(center - 3)); bin <= Math.floor(center + 3); bin++) {
              weights.set(bin, (weights.get(bin) || 0) + windowResponse(bin - center) * (h === 1 ? rootGain : 1) / h ** rolloff);
            }
          }
          const bins = [...weights.keys()];
          const values = [...weights.values()];
          this.atoms.push({ note, bins, weights: values, norm: values.reduce((sum, x) => sum + x * x, 0) });
        }
      }
    }
    this.coefficients = new Float32Array(this.atoms.length);
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
    if (gateOpen) this.propose(decibels, noise, peak);
    else { this.atoms = []; this.coefficients = new Float32Array(0); }
    // Supported notes compete for the same spectrum; no individual FFT peak
    // becomes a voice without a multi-partial hypothesis and a joint fit.
    const order = this.atoms.map((atom, index) => {
      let dot = 0;
      for (let j = 0; j < atom.bins.length; j++) dot += this.residual[atom.bins[j]!]! * atom.weights[j]!;
      return { index, score: dot / Math.sqrt(atom.norm) };
    }).sort((a, b) => b.score - a.score);
    // Sparse nonnegative least squares: notes compete to explain the same
    // partials, instead of turning each harmonic peak into another note.
    const penalty = Math.max(noise * 2, peak * 0.018);
    for (let pass = 0; pass < 32; pass++) {
      for (const { index } of order) {
        const atom = this.atoms[index]!;
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
    // Compare octave relatives inside each pitch family, including mixed
    // chords. Unrelated pitches must not disable harmonic suppression. Keep
    // lower supported voices when a higher octave dominates the mixture.
    // ponytail: steady mono spectra cannot prove a quiet octave is a second
    // string. Off keeps those voices; recordings must guide this preference.
    const ratio = Number.isFinite(octaveRatio) ? Math.max(0, Math.min(1, octaveRatio)) : 0.65;
    if (ratio > 0) {
      candidates = candidates.filter(item => {
        const strongest = candidates.find(other => other.note % 12 === item.note % 12)!;
        if (item.note <= strongest.note || item.amplitude >= strongest.amplitude * ratio) return true;
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
