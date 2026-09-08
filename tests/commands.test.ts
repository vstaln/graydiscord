import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { moderationCommands } from '../src/moderation.ts';

const names = moderationCommands.map((c: any) => c.name);

describe('usual commands', () => {
  for (const n of ['unban', 'untimeout', 'slowmode', 'lock', 'unlock', 'userinfo', 'serverinfo', 'avatar']) {
    it(`registers /${n}`, () => {
      assert.ok(names.includes(n), `missing /${n} (have: ${names.join(',')})`);
    });
  }

  it('locks mod commands behind permissions', () => {
    const byName = Object.fromEntries(moderationCommands.map((c: any) => [c.name, c]));
    for (const n of ['ban', 'kick', 'unban', 'timeout', 'untimeout', 'purge', 'slowmode', 'lock', 'unlock', 'warn']) {
      assert.ok(byName[n].default_member_permissions, `/${n} has no permission gate`);
    }
  });
});
