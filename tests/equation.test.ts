import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { threshold, levelOf } from '../src/leveling.ts';

// f(x) = 10·x·10^(6−x): 5→500, 4→4000, 3→30000, 2→200000, 1→1000000
describe('threshold equation', () => {
  it('derives every rank threshold from f(x) = 10·x·10^(6−x)', () => {
    assert.equal(threshold(5), 500);
    assert.equal(threshold(4), 4_000);
    assert.equal(threshold(3), 30_000);
    assert.equal(threshold(2), 200_000);
    assert.equal(threshold(1), 1_000_000);
  });

  it('x=0 collapses to 0=0, so it is NONE — never a usable threshold', () => {
    assert.equal(threshold(0), null);
    assert.equal(threshold(-1), null);
    assert.equal(threshold(6), null);
  });

  it('levelOf stays consistent with the equation and never resets to 0 up top', () => {
    assert.equal(levelOf(1_000_000), 1);
    assert.equal(levelOf(50_000_000), 1);
    assert.equal(levelOf(threshold(2)!), 2);
    assert.equal(levelOf(threshold(5)! - 1), 0);
  });
});
