import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AVATARS, assignAvatars } from '../src/protocol.ts';

test('humans keep their avatar, bots and duplicates get distinct free ones', () => {
  for (let i = 0; i < 50; i++) {
    const players = assignAvatars([
      { avatar: 'noxariel' },
      { avatar: 'noxariel' }, // duplicate: reassigned
      { bot: 'easy', avatar: 'ordeval' }, // bots never pick
      { avatar: 'nope' }, // invalid: reassigned
    ]);
    assert.equal(players[0].avatar, 'noxariel');
    const ids = players.map(p => p.avatar);
    assert.equal(new Set(ids).size, 4);
    assert.ok(ids.every(id => AVATARS.some(a => a.id === id)));
  }
});
