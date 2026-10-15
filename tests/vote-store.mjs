import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createPinia } from 'pinia';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('#shared/')) {
      return nextResolve(new URL(`../shared/${specifier.slice(8)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});
globalThis.useRuntimeConfig = () => ({ public: { maxVotes: '5' } });
const { useSongStore } = await import('../app/stores/songs.ts');
const first = useSongStore(createPinia());
const second = useSongStore(createPinia());
const writes = [];
let finishFirst;
first.songs = [{ songId: 'first', voted: false }];
second.songs = [{ songId: 'second', voted: false }];
first.writeVote = async (id, on) => {
  writes.push({ store: 'first', id, on });
  await new Promise(resolve => { finishFirst = resolve; });
};
second.writeVote = async (id, on) => { writes.push({ store: 'second', id, on }); };
first.setVotedState = second.setVotedState = async () => {};
assert.equal(first.toggleVote('first'), true);
assert.equal(second.toggleVote('second'), true);
await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(writes, [
  { store: 'first', id: 'first', on: true },
  { store: 'second', id: 'second', on: true },
], 'separate Pinia instances must never share a queue or its store callbacks');
assert.equal(first.savingVotes, true);
assert.equal(second.savingVotes, false);
finishFirst();
await new Promise(resolve => setImmediate(resolve));
assert.equal(first.savingVotes, false);
console.log('Independent Pinia vote queues and busy states passed without database access');
