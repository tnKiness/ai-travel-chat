import { describe, expect, it } from 'vitest';
import { inlineRuns } from '../src/markdown';

describe('inlineRuns', () => {
  it('parses bold, italic and code', () => {
    expect(inlineRuns('**Huế** is _lovely_ — try `bún bò`')).toEqual([
      { kind: 'bold', text: 'Huế' },
      { kind: 'plain', text: ' is ' },
      { kind: 'italic', text: 'lovely' },
      { kind: 'plain', text: ' — try ' },
      { kind: 'code', text: 'bún bò' },
    ]);
  });

  it('leaves snake_case identifiers alone', () => {
    expect(inlineRuns('set ANTHROPIC_API_KEY and max_tokens')).toEqual([
      { kind: 'plain', text: 'set ANTHROPIC_API_KEY and max_tokens' },
    ]);
  });

  it('treats unmatched markers as plain text', () => {
    expect(inlineRuns('2 * 3 = 6, a_b')).toEqual([{ kind: 'plain', text: '2 * 3 = 6, a_b' }]);
  });
});
