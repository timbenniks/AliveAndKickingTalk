import assert from 'node:assert/strict';
import { presetAtTime, buildSetlist, performVote } from '../shared/utils/performance.ts';

const presets = [{ name: 'Clean', at: 0, pc: 0 }, { name: 'Lead', at: 10, pc: 5 }];
assert.equal(presetAtTime([], 0), undefined);
assert.equal(presetAtTime(presets, 0)?.pc, 0);
assert.equal(presetAtTime(presets, 9.99)?.pc, 0);
assert.equal(presetAtTime(presets, 10)?.pc, 5);
assert.equal(presetAtTime(presets, 2)?.pc, 0); // Seeking backwards.
assert.equal(presetAtTime([...presets].reverse(), 11)?.pc, 5);
assert.equal(presetAtTime([{ name: 'Intro', at: 5, pc: 3 }], 1)?.pc, 3); // Before the first preset.
const songs = ['a', 'b', 'c', 'd', 'e'].map((songId, i) => ({ songId, votes: i }));
const before = structuredClone(songs);
const list = buildSetlist(songs, [{ songId: 'b', mashupSpot: 2 }]);
assert.deepEqual(list.map(song => song.songId), ['e', 'b', 'd', 'c']);
assert.equal(list[1].blocked, true);
assert.deepEqual(songs, before); // Deriving the setlist must not reorder the store.
assert.equal(new Set(buildSetlist(songs, [{ songId: 'missing', mashupSpot: 1 }]).map(song => song.songId)).size, 4);
const state = { voting: false, errorMessage: '' };
assert.equal(await performVote(state, async () => { throw Error('network'); }), false);
assert.equal(state.voting, false);
assert.ok(state.errorMessage);
assert.equal(await performVote(state, async () => {}), true);
assert.equal(state.errorMessage, '');
assert.equal(state.voting, false);
state.voting = true;
assert.equal(await performVote(state, async () => assert.fail('duplicate request')), false);
console.log('Preset boundaries, setlist ordering and voting recovery checks passed');
