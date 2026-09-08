import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addMessageXp, levelOf, nextThreshold, MAX_XP } from '../src/leveling.ts';

describe('tatsu algo', () => {
  it('grants 10-20 xp per 2-min window (not length-scaled 5-25)', () => {
    const r = addMessageXp('tdd', `u-${Date.now()}`, 'hello world this is a real message', 0);
    assert.equal(r.granted, true);
    const gained = r.xp; // fresh user so xp === gained
    assert.ok(gained >= 10 && gained <= 20, `expected 10-20, got ${gained}`);
  });

  it('one award per window: second message inside cooldown grants nothing', () => {
    const u = `u-${Date.now()}-w`;
    const a = addMessageXp('tdd', u, 'first real message here yes', 120_000);
    assert.equal(a.granted, true);
    const b = addMessageXp('tdd', u, 'a totally different message here', 120_000);
    assert.equal(b.granted, false);
    assert.equal(b.xp, a.xp);
  });
});

describe('prestige cap (NONE after 1)', () => {
  it('never wraps to 0 at cap', () => {
    assert.equal(levelOf(MAX_XP), 1);
    assert.equal(levelOf(Number.MAX_SAFE_INTEGER), 1);
    assert.equal(levelOf(Infinity), 0); // invalid input sanitizes to 0, never a fake rank
  });

  it('rank 1 has no next threshold (NONE)', () => {
    assert.equal(nextThreshold(1_000_000), null);
    assert.equal(nextThreshold(2_000_000), null);
    assert.equal(nextThreshold(500), 4_000);
  });
});
