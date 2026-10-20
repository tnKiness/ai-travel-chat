import type { ChatEvent } from './events.js';

/** Serialises one event in `text/event-stream` format. */
export function encodeEvent(event: ChatEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * Incremental SSE parser. Network chunks can split an event anywhere — even inside a
 * multi-byte character — so callers feed decoded text as it arrives and get back only
 * the events that are complete.
 */
export class SseParser {
  private buffer = '';

  push(chunk: string): ChatEvent[] {
    this.buffer += chunk.replace(/\r\n?/g, '\n');
    const events: ChatEvent[] = [];
    let boundary: number;
    while ((boundary = this.buffer.indexOf('\n\n')) !== -1) {
      const raw = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      const data = raw
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''))
        .join('\n');
      // Comment-only blocks (": ping") carry no data and are keep-alives.
      if (!data) continue;
      try {
        events.push(JSON.parse(data) as ChatEvent);
      } catch {
        // Ignore malformed frames rather than killing the whole stream.
      }
    }
    return events;
  }
}
