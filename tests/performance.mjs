import assert from 'node:assert/strict';
import { presetAtTime, buildSetlist, performVote, createVoteQueue } from '../shared/utils/performance.ts';

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
// Vote queue: writes run in tap order, one at a time, then one resync.
const log = [];
let inFlight = 0;
const queue = createVoteQueue({
  write: async (songId, on) => {
    inFlight += 1;
    assert.equal(inFlight, 1); // Never two writes at once.
    await new Promise(resolve => setTimeout(resolve, 5));
    if (songId === 'broken') { inFlight -= 1; throw Error('network'); }
    log.push(`${on ? '+' : '-'}${songId}`);
    inFlight -= 1;
  },
  resync: async () => { log.push('resync'); },
  onError: () => { log.push('error'); },
});
queue.push('a', true);
queue.push('b', true);
await queue.push('a', false);
assert.deepEqual(log, ['+a', '+b', '-a', 'resync']);
log.length = 0;
await queue.push('broken', true);
assert.deepEqual(log, ['error', 'resync']); // A failed save still resyncs, which undoes it on screen.

// A tap during resync must be written before either caller reports completion.
let releaseResync;
let resyncStarted;
const syncing = new Promise(resolve => { resyncStarted = resolve; });
const duringResync = [];
const busy = [];
let snapshots = 0;
const racingQueue = createVoteQueue({
  write: async (id, on) => { duringResync.push([id, on]); },
  resync: async () => {
    snapshots++;
    if (snapshots === 1) {
      resyncStarted();
      await new Promise(resolve => { releaseResync = resolve; });
    }
  },
  onBusy: value => busy.push(value),
  onError: assert.fail,
});
const firstSave = racingQueue.push('first', true);
await syncing;
const secondSave = racingQueue.push('second', true);
const removeFirst = racingQueue.push('first', false);
releaseResync();
await Promise.all([firstSave, secondSave, removeFirst]);
assert.deepEqual(duringResync, [['first', true], ['second', true], ['first', false]]);
assert.equal(snapshots, 2);
assert.deepEqual(busy, [true, false]);
await racingQueue.push('third', true);
assert.deepEqual(duringResync.at(-1), ['third', true]);
console.log('Preset boundaries, setlist ordering, voting recovery and vote queue checks passed');
