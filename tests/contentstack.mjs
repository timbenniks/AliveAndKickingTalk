import assert from 'node:assert/strict';
import { normalizeSong } from '../server/lib/contentstack.ts';

const entry = {
  songid: 'beat_it', song: 'Beat It', artist: 'Michael Jackson', mp3: '/beat_it.mp3', length: '4:00',
  cover: [{ secure_url: 'https://res.cloudinary.com/demo/image/upload/v123/cover.jpg', public_id: 'cover', version: 123 }],
  artwork: { imageConnection: { edges: [{ node: { url: 'https://images.example.com/art.jpg' } }] } },
};
const song = normalizeSong(entry);
assert.equal(song.songId, 'beat_it');
assert.equal(song.cover, 'https://res.cloudinary.com/demo/image/upload/q_auto,f_auto/cover.jpg');
assert.equal(song.artwork[0].bg, 'https://images.example.com/art.jpg');
assert.equal(song.artwork[0].publicId, 'cover');
assert.deepEqual(song.presets, []);
assert.equal(normalizeSong({ ...entry, artwork: undefined }).artwork[0].bg, song.cover);
assert.throws(() => normalizeSong({ ...entry, cover: [] }), /required content/);
console.log('Contentstack normalization checks passed');
