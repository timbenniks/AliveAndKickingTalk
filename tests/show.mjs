import assert from 'node:assert/strict';
import { createTapLimiter, createTapTally } from '../shared/show/taps.ts';
import { createPowerMeter } from '../shared/show/meter.ts';
import { createEncoreWindow, encoreThreshold, pickEncoreSong, encoreHref } from '../shared/show/encore.ts';
import { formatShowPhase, parseShowPhase } from '../shared/show/phase.ts';

// Phone limiter: N taps per rolling second.
const limiter = createTapLimiter(3);
assert.deepEqual([0, 100, 200, 300].map(t => limiter.allow(t)), [true, true, true, false]);
assert.equal(limiter.allow(999), false);
assert.equal(limiter.allow(1000), true); // The first tap has left the window.

// Stage tally: each uid is capped per window, and old taps expire.
const tally = createTapTally(1000, 2);
assert.equal(tally.add('a', 0), true);
assert.equal(tally.add('a', 10), true);
assert.equal(tally.add('a', 20), false); // Over the per-uid cap.
assert.equal(tally.add('b', 20), true); // Others are unaffected.
assert.equal(tally.count(20), 3);
assert.equal(tally.add('a', 1005), true); // a's first tap expired.
assert.equal(tally.count(1500), 1); // Only the tap at 1005 is still in the window.
assert.equal(tally.count(5000), 0);

// Power meter: fills with taps, scaled by audience (minimum 5).
let meter = createPowerMeter({ gain: 0.1, decayPerSecond: 0.1, cooldownMs: 20000 });
assert.ok(Math.abs(meter.taps(1, 1, 0).level - 0.02) < 1e-9); // Small rooms count as 5.
meter = createPowerMeter({ gain: 0.1, decayPerSecond: 0.1, cooldownMs: 20000 });
assert.ok(Math.abs(meter.taps(1, 10, 0).level - 0.01) < 1e-9); // Bigger rooms need more taps.
// Linear decay over time.
meter = createPowerMeter({ gain: 1, decayPerSecond: 0.1, cooldownMs: 20000 });
meter.taps(2, 5, 0); // 0.4
assert.ok(Math.abs(meter.tick(1000).level - 0.3) < 1e-9);
assert.equal(meter.tick(10000).level, 0); // Never below zero.
// Full fires once, resets and cools down.
meter = createPowerMeter({ gain: 1, decayPerSecond: 0, cooldownMs: 20000 });
const full = meter.taps(5, 5, 0);
assert.equal(full.full, true);
assert.equal(full.level, 0);
assert.equal(full.cooling, true);
assert.equal(meter.tick(1).full, false); // Only once.
assert.equal(meter.taps(5, 5, 1000).level, 0); // Taps ignored while cooling.
const after = meter.taps(2, 5, 20000);
assert.equal(after.cooling, false);
assert.ok(Math.abs(after.level - 0.4) < 1e-9);

// Encore: threshold scales with the room, never below 3.
assert.equal(encoreThreshold(0), 3);
assert.equal(encoreThreshold(20), 7);
const encore = createEncoreWindow({ endsAt: 15000, audience: 20 });
encore.tap('a', 0); encore.tap('a', 10); encore.tap('b', 20);
let state = encore.state(5000);
assert.equal(state.taps, 2); // Unique voters only.
assert.equal(state.threshold, 7);
assert.equal(state.remainingMs, 10000);
assert.equal(state.result, null);
encore.setAudience(6); // Audience shrank: threshold drops to the floor.
for (const uid of ['c', 'd']) encore.tap(uid, 6000);
assert.equal(encore.state(6000).threshold, 3);
assert.equal(encore.state(6000).progress, 1);
encore.tap('late', 15000); // After the window: ignored.
state = encore.state(15000);
assert.equal(state.result, 'won');
assert.equal(state.taps, 4);
assert.equal(state.remainingMs, 0);
const quiet = createEncoreWindow({ endsAt: 1000, audience: 30 });
quiet.tap('a', 0);
assert.equal(quiet.state(999).result, null);
assert.equal(quiet.state(1000).result, 'lost');

// Encore song: top-voted unplayed, ties keep setlist order.
const setlist = [{ songId: 'a', votes: 3 }, { songId: 'b', votes: 9 }, { songId: 'c', votes: 9 }, { songId: 'd', votes: 1 }];
assert.equal(pickEncoreSong(setlist, []), 'b');
assert.equal(pickEncoreSong(setlist, [{ songId: 'b' }]), 'c');
assert.equal(pickEncoreSong(setlist, setlist.map(({ songId }) => ({ songId }))), null);

// Show phase: config value round trip; anything else is idle.
assert.deepEqual(parseShowPhase('playing'), { kind: 'playing' });
assert.deepEqual(parseShowPhase('idle'), { kind: 'idle' });
const encorePhase = { kind: 'encore', endsAt: Date.parse('2026-10-15T20:00:15.000Z') };
assert.equal(formatShowPhase(encorePhase), 'encore:2026-10-15T20:00:15.000Z');
assert.deepEqual(parseShowPhase(formatShowPhase(encorePhase)), encorePhase);
for (const junk of [null, undefined, '', 'party', 'encore:', 'encore:not-a-date']) {
  assert.deepEqual(parseShowPhase(junk), { kind: 'idle' });
}

// The encore link: the song page, or the next mashup spot.
assert.equal(encoreHref('the_trooper'), '/live/the_trooper');
assert.equal(encoreHref('the_trooper', 4), '/live/the_trooper?spot=5&autoplay=true');

console.log('Tap limits, power meter, encore window and show phase checks passed');
