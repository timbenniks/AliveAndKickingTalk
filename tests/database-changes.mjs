import assert from 'node:assert/strict';

let mount;
let unmount;
const handlers = [];
const removed = [];
let subscribed = 0;
const channel = {
  on: (event, filter, handler) => { handlers.push({ event, filter, handler }); return channel; },
  subscribe: () => { subscribed++; },
};
globalThis.useSupabaseClient = () => ({ channel: () => channel, removeChannel: value => { removed.push(value); } });
globalThis.onMounted = callback => { mount = callback; };
globalThis.onUnmounted = callback => { unmount = callback; };
const { useDatabaseChanges } = await import('../app/composables/useDatabaseChanges.ts');
let updates = 0;
let played = 0;
useDatabaseChanges('test', [
  { table: 'config', event: 'UPDATE', callback: () => { updates++; } },
  { table: 'songs_played', event: '*', callback: () => { played++; } },
]);
assert.equal(subscribed, 0, 'SSR/setup does not open a subscription');
mount();
assert.equal(subscribed, 1);
handlers[0].handler({ eventType: 'INSERT', new: {} });
assert.equal(updates, 0);
handlers[0].handler({ eventType: 'UPDATE', new: {} });
handlers[1].handler({ eventType: 'DELETE', new: {} });
assert.equal(updates, 1);
assert.equal(played, 1);
unmount();
assert.deepEqual(removed, [channel], 'only the component-owned channel is removed');
console.log('Database change filtering and mount/unmount ownership passed');
