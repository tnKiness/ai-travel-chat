import { describe, expect, it } from 'vitest';
import { encodeEvent, SseParser } from '../src/sse.js';
import type { ChatEvent } from '../src/events.js';

const events: ChatEvent[] = [
  { type: 'start', conversationId: 'c1' },
  { type: 'text', delta: 'Xin chào 👋\nHội An' },
  { type: 'tool_start', id: 't1', name: 'search_places', input: { city: 'hoi-an' } },
  { type: 'done', stopReason: 'complete' },
];
const wire = events.map(encodeEvent).join('');

describe('SseParser', () => {
  it('round-trips encoded events', () => {
    expect(new SseParser().push(wire)).toEqual(events);
  });

  it('handles events split at every possible byte offset', () => {
    for (let cut = 1; cut < wire.length; cut++) {
      const parser = new SseParser();
      const got = [...parser.push(wire.slice(0, cut)), ...parser.push(wire.slice(cut))];
      expect(got).toEqual(events);
    }
  });

  it('ignores keep-alive comments and CRLF line endings', () => {
    const parser = new SseParser();
    const input = `: ping\r\n\r\n${encodeEvent(events[0]!).replace(/\n/g, '\r\n')}`;
    expect(parser.push(input)).toEqual([events[0]]);
  });

  it('skips malformed frames without losing later events', () => {
    const parser = new SseParser();
    expect(parser.push(`data: {oops\n\n${encodeEvent(events[3]!)}`)).toEqual([events[3]]);
  });
});
