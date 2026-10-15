import assert from 'node:assert/strict';
import { nextTick } from 'vue';
import { createRigDisplay } from '../app/utils/rig-display.ts';
import { readPreference, writePreference } from '../app/utils/preferences.ts';

const saved = new Map();
globalThis.localStorage = {
  getItem: key => saved.get(key) ?? null,
  setItem: (key, value) => saved.set(key, value),
};
saved.set('alive-rig-display', JSON.stringify({ forceReduced: true, showGuitarNotes: false }));
const first = createRigDisplay();
const second = createRigDisplay();
first.load();
second.load();
assert.equal(first.forceReduced.value, true);
assert.equal(first.showGuitarNotes.value, false);
first.lowQuality.value = true;
await nextTick();
assert.equal(second.lowQuality.value, false, 'preferences are not shared reactive state between apps');
assert.equal(JSON.parse(saved.get('alive-rig-display')).lowQuality, true);
first.load();
assert.equal(first.lowQuality.value, true, 'another consumer does not reload over current settings');
first.dispose();
const before = saved.get('alive-rig-display');
first.showGuitarNotes.value = true;
await nextTick();
assert.equal(saved.get('alive-rig-display'), before, 'disposing the app stops its persistence watcher');
second.dispose();

for (const value of ['broken json', 'null']) {
  saved.set('alive-rig-display', value);
  const display = createRigDisplay();
  display.load();
  assert.equal(display.showGuitarNotes.value, true, 'corrupt preferences fall back to defaults');
  display.dispose();
}
globalThis.localStorage = {
  getItem: () => { throw Error('storage blocked'); },
  setItem: () => { throw Error('storage blocked'); },
};
assert.equal(readPreference('blocked'), '');
assert.doesNotThrow(() => writePreference('blocked', 'value'));
console.log('App-scoped Rig settings, persistence, disposal and denied storage checks passed');
