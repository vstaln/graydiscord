import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildLiveEmbed } from '../src/streams.ts';

describe('simulcast alert', () => {
  it('one embed links all three platforms', () => {
    const e = buildLiveEmbed().toJSON();
    const text = `${e.title} ${e.description}`;
    assert.ok(text.includes('twitch.tv/vstaln'), 'twitch link');
    assert.ok(text.includes('youtube.com'), 'youtube link');
    assert.ok(text.includes('x.com/vstalingrady'), 'x link');
  });
});
