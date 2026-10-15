import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { GuitarPolyDetector } from '../shared/stage/guitar-poly.ts';
import { guitarPitchLane } from '../shared/stage/guitar-notes.ts';
import { spectrum } from './guitar-signal.mjs';

const fixtures = [
  [40], [45], [52], [64], [76], [40, 55, 59], [45, 60, 64],
  [40, 47, 52, 56, 59, 64], // E major, six voices including overlapping partials.
  [45, 52, 57, 60, 64], // A minor.
  [43, 47, 50, 55, 59, 67], // G major.
  [38, 45, 50, 54, 57, 62], // Drop D.
];
for (const sampleRate of [44100, 48000]) {
  for (const notes of fixtures) {
    const detector = new GuitarPolyDetector(sampleRate, 4096);
    let hits = [];
    let detected;
    for (let frame = 0; frame < 8; frame++) {
      detected = detector.process(spectrum(notes, { sampleRate, time: frame / 30, noise: 0.0001 }), frame / 30);
      hits.push(...detected.hits);
    }
    if (notes.length <= 3 || notes[0] === 40) {
      assert.deepEqual(detected.notes, notes.toSorted((a, b) => a - b), `${sampleRate} Hz, ${notes}`);
      assert.deepEqual(hits.map(hit => hit.lane).toSorted(), notes.map(guitarPitchLane).toSorted(), 'one attack per voice, no sustained retriggers');
    } else {
      // Dense octave chords are deliberately measured, not claimed perfect:
      // phase cancellation can hide a root and create an octave substitution.
      const correct = notes.filter(note => detected.notes.includes(note)).length;
      const falseNotes = detected.notes.filter(note => !notes.includes(note)).length;
      assert.ok(correct >= notes.length - 2 && falseNotes <= 2, `dense chord regression: ${notes} -> ${detected.notes}`);
      assert.ok(hits.length <= notes.length + 2, 'dense sustain must not flood note-ons');
      console.log(`Dense chord ${notes}: ${correct}/${notes.length} pitches, ${falseNotes} extra (${sampleRate} Hz).`);
    }
    assert.ok(detected.notes.length <= 6, 'maximum six tracked voices');
    const silence = new Float32Array(2048).fill(-Infinity);
    for (let frame = 8; frame < 13; frame++) detected = detector.process(silence, frame / 30);
    assert.deepEqual(detected.notes, [], 'release clears all voices');
    detector.process(spectrum(notes, { sampleRate }), 0.5);
    assert.ok(detector.process(spectrum(notes, { sampleRate }), 0.54).hits.length >= Math.min(3, notes.length), 're-strum produces fresh attacks');
  }
}
for (let pitch = 38; pitch <= 88; pitch++) {
  const detector = new GuitarPolyDetector(48000, 4096);
  const input = spectrum([pitch]);
  detector.process(input, 0);
  assert.deepEqual(detector.process(input, 0.04).notes, [pitch], `supported pitch ${pitch}`);
}
for (const sampleRate of [96000, 192000]) {
  const size = sampleRate / 48000 * 4096;
  const detector = new GuitarPolyDetector(sampleRate, size);
  const input = spectrum([45, 60, 64], { sampleRate, size });
  detector.process(input, 0);
  assert.deepEqual(detector.process(input, 0.04).notes, [45, 60, 64], `${sampleRate} Hz interface`);
}
const restruck = new GuitarPolyDetector(48000, 4096);
const sustained = spectrum([52], { amplitude: 0.02 });
restruck.process(sustained, 0);
restruck.process(sustained, 0.04);
restruck.process(sustained, 0.16);
assert.equal(restruck.process(spectrum([52]), 0.2).hits.length, 1, 'a stronger repeat attack can retrigger a ringing note');
for (const rolloff of [0.8, 2]) {
  const detector = new GuitarPolyDetector(48000, 4096);
  const input = spectrum([40], { rolloff });
  detector.process(input, 0);
  assert.deepEqual(detector.process(input, 0.04).notes, [40], 'bright/dark single notes do not create harmonic notes');
}
const tuned = new GuitarPolyDetector(48000, 4096, -35);
const detuned = spectrum([45, 60, 64], { cents: -35 });
tuned.process(detuned, 0);
assert.deepEqual(tuned.process(detuned, 0.04).notes, [45, 60, 64], 'tuning calibration');
// Reproduce quiet DI input at the default gate, not only with the gate at
// its minimum. Detection should not require harmonics individually above it.
for (const amplitude of [0.001, 0.003, 0.01]) {
  for (const notes of [[40], [45, 60, 64], [40, 47, 52, 56, 59, 64]]) {
    const quietDetector = new GuitarPolyDetector(48000, 4096);
    const input = spectrum(notes, { amplitude, noise: 0.00001 });
    quietDetector.process(input, 0);
    assert.deepEqual(quietDetector.process(input, 0.04).notes, notes, `quiet DI ${amplitude}, ${notes}`);
  }
}
const hiss = new GuitarPolyDetector(48000, 4096);
for (let frame = 0; frame < 12; frame++) {
  const detected = hiss.process(spectrum([], { noise: 0.05 }), frame / 30);
  assert.ok(detected.inputDb > -65, 'noise fixture opens the signal gate');
  assert.deepEqual(detected.notes, [], 'broadband hiss above the gate is not a guitar note');
  assert.deepEqual(detected.hits, [], 'hiss creates no gems');
}
const noisyQuiet = new GuitarPolyDetector(48000, 4096);
const noisyInput = spectrum([40], { amplitude: 0.001, noise: 0.0005 });
noisyQuiet.process(noisyInput, 0);
const noisyDetection = noisyQuiet.process(noisyInput, 0.04);
assert.deepEqual(noisyDetection.notes, [40], 'quiet guitar remains detectable above background hiss');
assert.ok(noisyDetection.inputDb > -65 && noisyDetection.inputDb < -55, 'debug signal uses an RMS estimate, not peak FFT-bin dB');
const gated = new GuitarPolyDetector(48000, 4096);
const quiet = spectrum([40], { amplitude: 0.001 });
gated.process(quiet, 0, -45);
assert.deepEqual(gated.process(quiet, 0.04, -45).notes, [], 'noise gate rejects quiet input');
gated.process(quiet, 0.08, -85);
assert.deepEqual(gated.process(quiet, 0.12, -85).notes, [40], 'lower gate admits quiet notes');
const detector = new GuitarPolyDetector(48000, 4096);
const chord = spectrum([40, 47, 52, 56, 59, 64]);
for (let i = 0; i < 30; i++) detector.process(chord, i / 30);
const started = performance.now();
for (let i = 0; i < 300; i++) detector.process(chord, 1 + i / 30);
console.log(`Polyphonic waveform regressions passed. Average fit: ${((performance.now() - started) / 300).toFixed(2)} ms (30 analyses/second).`);
