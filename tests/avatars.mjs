import assert from 'node:assert/strict';
import { avatarSource } from '../shared/utils/avatars.ts';

assert.equal(avatarSource('https://avatars.githubusercontent.com/u/1?v=4'), 'https://avatars.githubusercontent.com/u/1?v=4');
assert.equal(avatarSource('https://pbs.twimg.com/profile_images/1/me_normal.jpg'), 'https://pbs.twimg.com/profile_images/1/me.jpg');
assert.ok(avatarSource('https://media.licdn.com/dms/image/abc/profile.jpg?e=1&t=x'));
assert.equal(avatarSource('http://avatars.githubusercontent.com/u/1'), null); // Not https.
assert.equal(avatarSource('https://evil.example.com/me.jpg'), null); // Not an avatar host.
assert.equal(avatarSource('https://avatars.githubusercontent.com.evil.example/x'), null);
assert.equal(avatarSource(''), null);
assert.equal(avatarSource('not a url'), null);
console.log('Avatar source allowlist checks passed');
