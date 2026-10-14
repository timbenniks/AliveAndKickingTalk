import assert from 'node:assert/strict';
import { createMashupImage, createPicksImage, createShareImage } from '../shared/utils/images.ts';
const songs = ['a', 'b', 'c', 'd'].map(songId => ({
  songId, song: songId, artist: 'AC/DC', coverPublicId: `covers/${songId}`,
  artwork: [{ publicId: `art/${songId}` }],
}));
const avatar = 'https://images.example.com/avatar.jpg';
const url = await createMashupImage(avatar, songs, 'd,c,b,a');
assert.equal(new URL(url).hostname, 'res.cloudinary.com');
assert.ok(url.indexOf('art:d') < url.indexOf('art:c'));
assert.ok(url.indexOf('art:c') < url.indexOf('art:b'));
await assert.rejects(createMashupImage(avatar, songs, 'a,b'), /four songs/);
const single = await createShareImage(avatar, songs[0]);
assert.equal(new URL(single).hostname, 'res.cloudinary.com');
assert.ok(single.includes('art/a'));
// Picks: four or more use the first four in setlist order; fewer use the first pick alone.
const five = [...songs, { ...songs[0], songId: 'e', coverPublicId: 'covers/e', artwork: [{ publicId: 'art/e' }] }];
const many = await createPicksImage(avatar, five, ['e', 'c', 'a', 'd', 'b']);
assert.ok(many.indexOf('art:a') < many.indexOf('art:b') && !many.includes('art:e'));
const few = await createPicksImage(avatar, songs, ['c', 'b']);
assert.ok(few.includes('art/b') && !few.includes('art/c'));
await assert.rejects(createPicksImage(avatar, songs, ['missing']), /at least one/);
console.log('Cloudinary single/mashup/picks image and selection-order checks passed');
