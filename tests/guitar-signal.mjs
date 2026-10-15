// Generate actual summed waveforms, then independently FFT a Blackman window,
// matching Web Audio's analyser scaling. No pre-populated detector templates.
export function spectrum(notes, { sampleRate = 48000, size = 4096, amplitude = 0.08, cents = 0, rolloff = 1.3, time = 0, noise = 0, noiseSeed = 123456, harmonicGains = [] } = {}) {
  const real = new Float64Array(size);
  const imag = new Float64Array(size);
  let seed = noiseSeed;
  for (let i = 0; i < size; i++) {
    let signal = 0;
    for (const voice of notes) {
      const note = typeof voice === 'number' ? voice : voice.note;
      const settings = typeof voice === 'number' ? {} : voice;
      const hz = 440 * 2 ** ((note - 69 + (settings.cents ?? cents) / 100) / 12);
      for (let harmonic = 1; harmonic <= 10; harmonic++) {
        signal += (settings.amplitude ?? amplitude) * ((settings.harmonicGains ?? harmonicGains)[harmonic - 1] ?? 1) / harmonic ** (settings.rolloff ?? rolloff) * Math.sin(2 * Math.PI * hz * harmonic * (time + i / sampleRate) + (settings.phase ?? note * 1.23) * harmonic);
      }
    }
    seed = (1664525 * seed + 1013904223) >>> 0;
    signal += noise * (seed / 2 ** 32 - 0.5);
    real[i] = signal * (0.42 - 0.5 * Math.cos(2 * Math.PI * i / size) + 0.08 * Math.cos(4 * Math.PI * i / size));
  }
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [real[i], real[j]] = [real[j], real[i]];
  }
  for (let length = 2; length <= size; length *= 2) {
    for (let start = 0; start < size; start += length) {
      for (let j = 0; j < length / 2; j++) {
        const angle = -2 * Math.PI * j / length;
        const a = start + j, b = a + length / 2;
        const r = real[b] * Math.cos(angle) - imag[b] * Math.sin(angle);
        const im = real[b] * Math.sin(angle) + imag[b] * Math.cos(angle);
        real[b] = real[a] - r; imag[b] = imag[a] - im;
        real[a] += r; imag[a] += im;
      }
    }
  }
  return Float32Array.from({ length: size / 2 }, (_, bin) => 20 * Math.log10(Math.max(1e-12, Math.hypot(real[bin], imag[bin]) / size)));
}

