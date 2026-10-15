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
// A single E with uneven upper partials used to create two lanes. Exercise
// changing attack/sustain timbres as well as levels, so suppression cannot
// leave an octave hanging through the release grace period.
for (const sampleRate of [44100, 48000]) {
  for (const pitch of [40, 52, 64]) {
    const detector = new GuitarPolyDetector(sampleRate, 4096);
    const hits = [];
    for (let frame = 0; frame < 10; frame++) {
      const boost = [1.5, 2, 2.5, 2, 1.5][frame % 5];
      const input = spectrum([pitch], { sampleRate, amplitude: 0.003, time: frame / 30,
        harmonicGains: [1, boost, 1, boost * 0.8, 1, boost * 0.6, 1, 1, 1, 1] });
      const detected = detector.process(input, frame / 30);
      if (frame > 0) assert.deepEqual(detected.notes, [pitch], 'one E despite changing harmonic balance');
      hits.push(...detected.hits);
    }
    assert.deepEqual(hits.map(hit => hit.lane), [guitarPitchLane(pitch)], 'no phantom octave gems');
  }
}
const brightE = spectrum([52], { harmonicGains: [1, 3, 1, 2.4, 1, 1.8, 1, 1, 1, 1] });
const strict = new GuitarPolyDetector(48000, 4096);
strict.process(brightE, 0, -65, 0.85);
assert.deepEqual(strict.process(brightE, 0.04, -65, 0.85).notes, [52], 'strong octave filtering');
const unfiltered = new GuitarPolyDetector(48000, 4096);
const unevenE = spectrum([52], { harmonicGains: [1, 2, 1, 1.6, 1, 1.2, 1, 1, 1, 1] });
unfiltered.process(unevenE, 0, -65, 0);
assert.deepEqual(unfiltered.process(unevenE, 0.04, -65, 0).notes, [52, 64], 'off preserves the original ambiguous fit');
assert.deepEqual(unfiltered.process(unevenE, 0.08, -65, 0.65).notes, [52], 'rejected octaves clear immediately');
const realOctaves = new GuitarPolyDetector(48000, 4096);
const pair = spectrum([52, 64]);
realOctaves.process(pair, 0);
assert.deepEqual(realOctaves.process(pair, 0.04).notes, [52, 64], 'clear real octave voices survive balanced filtering');
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
// Research failures: propose continuous pitches from partials, including an
// absent root, rather than only asking whether a fixed semitone template fits.
for (const sampleRate of [44100, 48000]) {
  for (const note of [40, 45, 52, 55, 64, 69, 76]) {
    for (const cents of [-35, -25, 0, 15, 25, 35]) {
      for (const fundamental of [0, 0.05, 1]) {
        const detector = new GuitarPolyDetector(sampleRate, 4096);
        const hits = [];
        for (let frame = 0; frame < 5; frame++) {
          const out = detector.process(spectrum([note], { sampleRate, cents,
            harmonicGains: [fundamental], time: frame / 60 }), frame / 60);
          if (frame > 0) assert.deepEqual(out.notes, [note], `pitch ${note}, ${cents} cents, root ${fundamental}, ${sampleRate} Hz`);
          hits.push(...out.hits);
        }
        assert.equal(hits.length, 1, 'weak/detuned sustained notes create one gem');
      }
    }
  }
  const chordDetector = new GuitarPolyDetector(sampleRate, 4096);
  const hits = [];
  for (let frame = 0; frame < 12; frame++) {
    const out = chordDetector.process(spectrum([52, 55], { sampleRate, time: frame / 60,
      harmonicGains: [1, 2, 1, 1.6, 1, 1.2, 1, 1, 1, 1] }), frame / 60);
    if (frame > 0) assert.deepEqual(out.notes, [52, 55], 'mixed chords do not bypass octave suppression');
    hits.push(...out.hits);
  }
  assert.equal(hits.length, 2, 'bright E/G produces two attacks, not four');
}
for (const voices of [
  [{ note: 52, cents: -28 }, { note: 55, cents: 32 }],
  [{ note: 45, cents: 31 }, { note: 60, cents: -25 }, { note: 64, cents: 22 }],
  [{ note: 52 }, { note: 64, amplitude: 0.02 }],
]) {
  const detector = new GuitarPolyDetector(48000, 4096);
  for (let frame = 0; frame < 8; frame++) {
    const out = detector.process(spectrum(voices, { time: frame / 60 }), frame / 60, -65, 0);
    if (frame > 0) assert.deepEqual(out.notes, voices.map(v => v.note), 'independent tuning and quiet real octave voices with filtering off');
  }
}
// New noise in every window must not form a persistent harmonic hypothesis.
const changingHiss = new GuitarPolyDetector(48000, 4096);
for (let frame = 0; frame < 100; frame++) {
  const out = changingHiss.process(spectrum([], { noise: 0.05, noiseSeed: 79 + frame * 1289 }), frame / 60);
  assert.deepEqual(out.notes, [], 'fresh broadband noise is not a sustained pitch');
  assert.deepEqual(out.hits, [], 'fresh broadband noise produces no attacks');
}
for (const note of [76, 83, 88]) {
  const detector = new GuitarPolyDetector(48000, 4096);
  const input = spectrum([note], { cents: 4 });
  detector.process(input, 0);
  assert.deepEqual(detector.process(input, 1 / 60).notes, [note], 'small high-note offsets keep their spectral resolution');
}
const vibrato = new GuitarPolyDetector(48000, 4096);
const vibratoHits = [];
for (let frame = 0; frame < 60; frame++) {
  const out = vibrato.process(spectrum([55], { cents: 30 * Math.sin(frame / 60 * 2 * Math.PI * 4), time: frame / 60 }), frame / 60);
  if (frame > 0) assert.deepEqual(out.notes, [55], 'vibrato within a semitone does not flicker');
  vibratoHits.push(...out.hits);
}
assert.equal(vibratoHits.length, 1, 'vibrato is not a stream of new attacks');

const detector = new GuitarPolyDetector(48000, 4096);
const chord = spectrum([40, 47, 52, 56, 59, 64]);
for (let i = 0; i < 30; i++) detector.process(chord, i / 60);
const started = performance.now();
for (let i = 0; i < 300; i++) detector.process(chord, 1 + i / 60);
console.log(`Polyphonic waveform regressions passed. Average fit: ${((performance.now() - started) / 300).toFixed(2)} ms (60 analyses/second).`);
