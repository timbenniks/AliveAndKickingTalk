// A deterministic stress sample, separate from the regression assertions.
// Optional comparison: node --experimental-strip-types tests/guitar-evaluation.mjs <git-ref>
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { GuitarPolyDetector } from '../shared/stage/guitar-poly.ts';
import { spectrum } from './guitar-signal.mjs';

const detectors = [['Current', GuitarPolyDetector]];
if (process.argv[2]) {
  const source = execFileSync('git', ['show', `${process.argv[2]}:shared/stage/guitar-poly.ts`], { encoding: 'utf8' })
    .replace("'./guitar-notes.ts'", JSON.stringify(new URL('../shared/stage/guitar-notes.ts', import.meta.url).href));
  const baseline = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
  detectors.unshift([process.argv[2], baseline.GuitarPolyDetector]);
}
const totals = new Map();
let cases = 0;
for (const notes of [[40], [52], [64], [40, 55, 59], [45, 60, 64], [52, 55], [52, 64], [40, 47, 52, 56, 59, 64], [45, 52, 57, 60, 64]]) {
  for (const phase of [0.1, 1.7, 3.1]) {
    for (const rolloff of [0.9, 1.3, 1.8]) {
      for (const variant of ['ordinary', 'detuned', 'weak-root', 'bright']) {
        cases++;
        const voices = notes.map((note, i) => ({
          note, phase: phase + i * 0.37, rolloff,
          cents: variant === 'detuned' ? (i % 2 ? -27 : 29) : 0,
          harmonicGains: variant === 'weak-root' ? [0.05] : variant === 'bright' ? [1, 2, 1, 1.6, 1, 1.2, 1, 1, 1, 1] : [],
        }));
        const inputs = Array.from({ length: 4 }, (_, frame) => spectrum(voices, { noise: 0.00001, time: frame / 60 }));
        for (const [name, Detector] of detectors) {
          const detector = new Detector(48000, 4096);
          const outputs = inputs.map((input, frame) => detector.process(input, frame / 60));
          const detected = outputs.at(-1).notes;
          const key = `${name} / ${variant}`;
          if (!totals.has(key)) totals.set(key, { cases: 0, expected: 0, exact: 0, missed: 0, extra: 0 });
          const row = totals.get(key);
          const missed = notes.filter(note => !detected.includes(note)).length;
          const extra = detected.filter(note => !notes.includes(note)).length;
          row.cases++;
          row.expected += notes.length;
          row.exact += Number(!missed && !extra);
          row.missed += missed;
          row.extra += extra;
        }
      }
    }
  }
}
console.log(`${cases} synthetic combinations; four observations at 60 Hz; default Balanced filtering.`);
console.log('Counts describe the final observation, not recorded-guitar accuracy or onset latency.');
console.table(Object.fromEntries(totals));
