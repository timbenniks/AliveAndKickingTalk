import assert from 'node:assert/strict';
import { activeCue, chapterMarks, presetCues } from '../shared/stage/timeline.ts';
import { bandLevels, guitarLaneBins, peakLevels, risingLanes } from '../shared/stage/pulses.ts';
import { themeForPreset } from '../shared/stage/themes.ts';
import { styleById } from '../shared/stage/styles.ts';
import { LANE_COLORS, LANE_X } from '../shared/stage/clock.ts';
import { emitMoment, onMoment } from '../shared/stage/moments.ts';

const backInBlack = { songId: 'back_in_black', presets: [
  { name: 'Stadium Rock', at: 0, pc: 2 }, { name: 'Face Bleeding Solo', at: 65, pc: 3 }, { name: 'Stadium Rock', at: 106, pc: 2 },
] };
const jungle = { songId: 'welcome_to_the_jungle', presets: [
  { name: 'Top Hat Solo', at: 0, pc: 3 }, { name: 'Stadium Rock', at: 31.5, pc: 2 },
  { name: 'Top Hat Solo', at: 65, pc: 3 }, { name: 'Stadium Rock', at: 83, pc: 2 },
] };
const trooper = { songId: 'the_trooper', presets: [
  { name: 'Up the irons!', at: 0, pc: 4 }, { name: 'The Troops', at: 14, pc: 5 }, { name: 'Up the Irons!', at: 98, pc: 4 },
] };

// Cues follow the amp presets, including seeks and unsorted input.
const cues = presetCues(backInBlack);
assert.equal(activeCue(cues, -1), undefined);
assert.equal(activeCue(cues, 0)?.presetName, 'Stadium Rock');
assert.equal(activeCue(cues, 64.9)?.at, 0);
assert.equal(activeCue(cues, 65)?.presetName, 'Face Bleeding Solo');
assert.equal(activeCue(cues, 105)?.programChange, 3);
assert.equal(activeCue([...cues].reverse(), 110)?.at, 106);
assert.deepEqual(cues.map(cue => cue.theme), ['neon-stadium', 'fire-solo', 'neon-stadium']);
assert.deepEqual(cues.map(cue => cue.style), ['stadium-smoke', 'solo-flames', 'stadium-smoke']);
assert.deepEqual(chapterMarks({ cues, sections: [] }).map(mark => [mark.label, mark.at, mark.detail]), [
  ['Stadium Rock', 0, 'Program 2'], ['Face Bleeding Solo', 65, 'Program 3'], ['Stadium Rock', 106, 'Program 2'],
]);

// Chapter overrides win over the preset name.
const jungleCues = presetCues(jungle);
assert.deepEqual(jungleCues.map(cue => cue.style), ['solo-flames', 'stadium-smoke', 'disco', 'iron-embers']);
assert.deepEqual(jungleCues.map(cue => cue.theme), ['tophat-crimson', 'neon-stadium', 'funky-magenta', 'iron-march']);
assert.ok(new Set(presetCues(trooper).map(cue => cue.theme)).size > 1);
assert.equal(themeForPreset('Up the Irons!'), themeForPreset('Up the irons!'));
assert.equal(themeForPreset('Not A Real Preset'), 'neon-stadium');

// Six lanes, one per guitar string.
assert.equal(LANE_X.length, 6);
assert.equal(LANE_COLORS.length, 6);
assert.equal(styleById('disco').gems.length, 6);

// Lanes light from a rising band and stay quiet when nothing spikes.
const freq = new Array(128).fill(0);
for (let i = 1; i < 4; i++) freq[i] = 255;
for (let i = 40; i < 90; i++) freq[i] = 200;
const levels = bandLevels(freq);
assert.equal(levels.length, 6);
assert.ok(Math.abs(levels[0] - 1) < 0.01);
assert.equal(levels[2], 0);
assert.ok(levels[4] > 0.5);
const last = [-10, -10, -10, -10, -10, -10];
assert.deepEqual(risingLanes([0.5, 0.12, 0.12, 0.12, 0.12, 0.4], [0.1, 0.1, 0.1, 0.1, 0.1, 0.1], 2, last), [0, 5]);
assert.deepEqual(risingLanes([0.5, 0.12, 0.12, 0.12, 0.12, 0.4], [0.1, 0.1, 0.1, 0.1, 0.1, 0.1], 2.05, [2, -10, -10, -10, -10, 2]), []);
assert.deepEqual(risingLanes([0.05, 0.05, 0.05, 0.05, 0.05, 0.05], [0, 0, 0, 0, 0, 0], 1, last), []);

// Guitar pitch zones are ordered, contiguous and cover the guitar's range.
const zones = guitarLaneBins(48000, 4096);
assert.equal(zones.length, 6);
for (let i = 1; i < zones.length; i++) assert.equal(zones[i][0], zones[i - 1][1]);
assert.ok(zones[0][0] * 48000 / 4096 <= 80 && zones[5][1] * 48000 / 4096 >= 1250);
const lowE = new Array(2048).fill(0);
lowE[Math.round(82 / (48000 / 4096))] = 255;
assert.ok(bandLevels(lowE, zones)[0] > 0);
assert.equal(bandLevels(lowE, zones)[5], 0);
// A single note in a wide zone still reads at full strength.
const highE = new Array(2048).fill(0);
highE[Math.round(329.6 / (48000 / 4096))] = 255;
assert.equal(peakLevels(highE, zones)[3], 1);
assert.ok(bandLevels(highE, zones)[3] < 0.2);

// The moment bus reaches every listener until it unsubscribes.
const heardA = [];
const heardB = [];
const stopA = onMoment(moment => heardA.push(moment.kind));
const stopB = onMoment(moment => heardB.push(moment.kind));
emitMoment({ kind: 'pyro' });
stopA();
emitMoment({ kind: 'title', lines: ['Encore!'], seconds: 3 });
stopB();
emitMoment({ kind: 'confetti' });
assert.deepEqual(heardA, ['pyro']);
assert.deepEqual(heardB, ['pyro', 'title']);

console.log('Stage cue, theme and six-lane pulse and moment bus checks passed');
