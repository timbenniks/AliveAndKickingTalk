import assert from 'node:assert/strict';
import { createMashupImage, createShareImage } from '../shared/utils/images.ts';
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
console.log('Cloudinary single/mashup image and selection-order checks passed');
