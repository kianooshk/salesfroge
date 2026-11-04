import { mentionDisplay, parseMentionIds } from './mentions';

describe('mentions', () => {
  it('reads user ids out of mention tokens and renders a readable body', () => {
    const body = 'Please loop in @[Sam Rivera](user_sam) and @[Riley Quinn](user_riley).';
    expect(parseMentionIds(body)).toEqual(['user_sam', 'user_riley']);
    expect(mentionDisplay(body)).toBe('Please loop in @Sam Rivera and @Riley Quinn.');
  });

  it('returns nothing for an empty body', () => {
    expect(parseMentionIds('')).toEqual([]);
    expect(mentionDisplay(null)).toBe('');
  });
});
