import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { GuitarDetector, GUITAR_TUNINGS, estimateGuitarString, guitarNoteName } from '../shared/stage/guitar.ts';

const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
function fill(frame, rate, now, hz, amplitude = 0.05, harmonics = [1, 0.8, 0.35]) {
  for (let i = 0; i < frame.length; i++) {
    const t = now - (frame.length - i) / rate;
    frame[i] = amplitude * (harmonics[0] * Math.sin(2 * Math.PI * hz * t)
      + harmonics[1] * Math.sin(4 * Math.PI * hz * t) + harmonics[2] * Math.sin(6 * Math.PI * hz * t));
  }
}

// Real waveforms with harmonics, several hardware sample rates and all tunings.
// Each note starts a new phrase: overlapping fretted positions remain ambiguous.
for (const rate of [44100, 48000, 96000, 192000]) {
  const detector = new GuitarDetector(rate);
  const frame = new Float32Array(detector.fftSize);
  for (const [tuning, { notes }] of Object.entries(GUITAR_TUNINGS)) {
    for (const [lane, midi] of notes.entries()) {
      detector.reset();
      let hits = 0;
      for (let k = 0; k < 8; k++) {
        fill(frame, rate, k / 60, frequency(midi));
        const result = detector.read(frame, k / 60, tuning);
        hits += Number(result.hit);
      }
      assert.equal(detector.result.lane, lane, `${rate}Hz ${tuning} string ${lane}`);
      assert.ok(Math.abs(detector.result.midi - midi) < 0.05);
      assert.equal(hits, 1, 'harmonics and sustain produce exactly one gem');
    }
  }
  for (let midi = 40; midi <= 88; midi++) {
    detector.reset();
    for (let k = 0; k < 3; k++) {
      fill(frame, rate, k / 60, frequency(midi));
      detector.read(frame, k / 60);
    }
    assert.ok(Math.abs(detector.result.midi - midi) < 0.2, `fretted note ${midi}`);
  }
}
assert.equal(guitarNoteName(40), 'E2');
assert.equal(guitarNoteName(63), 'D♯4');
assert.equal(estimateGuitarString(30, 'standard'), -1);
assert.equal(estimateGuitarString(65, 'standard', 4, 64), 4, 'small bends retain a plausible previous string');

const rate = 48000;
const detector = new GuitarDetector(rate);
const frame = new Float32Array(detector.fftSize);
// Weak/missing fundamentals must not turn upper harmonics into higher notes.
for (const harmonics of [[0.1, 1, 0], [0, 1, 0.7], [0.2, 1, 0.1]]) {
  detector.reset();
  for (let k = 0; k < 8; k++) {
    fill(frame, rate, k / 60, frequency(40), 0.05, harmonics);
    detector.read(frame, k / 60);
  }
  assert.equal(detector.result.lane, 0);
  assert.ok(Math.abs(detector.result.midi - 40) < 0.1);
}
// A gradual whole-tone bend stays on the original string and does not count
// each semitone as a new pick. An abrupt legato change can create a new gem.
detector.reset();
for (let k = 0; k < 6; k++) {
  fill(frame, rate, k / 60, frequency(43));
  detector.read(frame, k / 60);
}
let bendHits = 0;
for (let k = 6; k < 36; k++) {
  fill(frame, rate, k / 60, frequency(43 + (k - 6) / 29 * 2));
  const result = detector.read(frame, k / 60);
  bendHits += Number(result.hit);
  assert.equal(result.lane, 0);
}
assert.equal(bendHits, 0);
let legatoHits = 0;
for (let k = 36; k < 42; k++) {
  fill(frame, rate, k / 60, frequency(48));
  legatoHits += Number(detector.read(frame, k / 60).hit);
}
assert.equal(legatoHits, 1);
detector.reset();
// Seeded broadband noise cannot become a guitar note, even above the gate.
let seed = 42;
for (let k = 0; k < 60; k++) {
  for (let i = 0; i < frame.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    frame[i] = (seed / 2 ** 32 - 0.5) * 0.02;
  }
  assert.equal(detector.read(frame, k / 60).hit, false);
}
// A quiet note is available with a lower gate; the gate can also exclude it.
for (const [gate, expectedHits] of [[-75, 1], [-50, 0]]) {
  detector.reset();
  let hits = 0;
  for (let k = 0; k < 10; k++) {
    fill(frame, rate, k / 60, frequency(40), 0.0005);
    hits += Number(detector.read(frame, k / 60, 'standard', gate).hit);
  }
  assert.equal(hits, expectedHits);
}
// Continuous captured audio: six repeated picks, 100ms apart, with no silence
// between them. This is faster than the old 130ms per-lane cooldown allowed.
detector.reset();
const picks = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
const hits = [];
for (let k = 0; k < 60; k++) {
  const now = k / 60;
  for (let i = 0; i < frame.length; i++) {
    const t = now - (frame.length - i) / rate;
    let envelope = 0;
    for (const pick of picks) if (t >= pick) envelope += 0.1 * Math.exp(-(t - pick) / 0.035);
    frame[i] = envelope * (Math.sin(2 * Math.PI * frequency(45) * t) + 0.5 * Math.sin(4 * Math.PI * frequency(45) * t));
  }
  const result = detector.read(frame, now);
  if (result.hit) hits.push(now);
}
assert.equal(hits.length, picks.length, `repeated pick times: ${hits}`);
for (let i = 0; i < picks.length; i++) assert.ok(hits[i] - picks[i] >= 0 && hits[i] - picks[i] < 0.1);

// No repeated event when display frames arrive faster than audio analysis.
detector.reset();
fill(frame, rate, 0, frequency(40));
detector.read(frame, 0);
assert.equal(detector.read(frame, 1 / 60).hit, true);
assert.equal(detector.read(frame, 1 / 60 + 1 / 144).hit, false);
assert.equal(detector.read(frame, 1 / 60 + 2 / 144).hit, false);
detector.reset();
assert.equal(detector.result.lane, -1);
assert.equal(detector.result.confidence, 0);

if (process.argv.includes('--benchmark')) {
  // Only detector work is timed. Include lowest notes and rejected noise, which
  // require more work than upper notes. This is a local CPU budget, not browser FPS.
  const timings = [];
  let now = 1;
  for (const midi of [38, 40, 45, 64, 88, null]) {
    fill(frame, rate, 0, midi === null ? 440 : frequency(midi));
    if (midi === null) for (let i = 0; i < frame.length; i++) frame[i] = Math.sin(i * i) * 0.05;
    for (let k = 0; k < 1100; k++) {
      now += 1 / 60;
      const start = performance.now();
      detector.read(frame, now, 'dropD');
      const elapsed = performance.now() - start;
      if (k >= 100) timings.push(elapsed);
    }
  }
  timings.sort((a, b) => a - b);
  console.log(`Detector CPU: mean ${(timings.reduce((a, b) => a + b, 0) / timings.length).toFixed(3)}ms; p95 ${timings[Math.floor(timings.length * 0.95)].toFixed(3)}ms; p99 ${timings[Math.floor(timings.length * 0.99)].toFixed(3)}ms (${timings.length} analyses)`);
}
console.log('Guitar waveform pitch, harmonics, tuning, noise, quiet input, repeated picking and refresh-rate checks passed');
