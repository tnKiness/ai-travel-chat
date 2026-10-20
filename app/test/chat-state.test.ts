import { describe, expect, it } from 'vitest';
import type { ChatEvent } from '@travel/shared';
import { applyEvent, type ChatMessage } from '../src/chat-state';

const empty: ChatMessage = { id: 'a', role: 'assistant', text: '', tools: [], status: 'streaming' };

function run(events: ChatEvent[]): ChatMessage {
  const mark = { current: 0 };
  return events.reduce((msg, e) => applyEvent(msg, e, mark), empty);
}

describe('applyEvent', () => {
  it('accumulates text and tool calls', () => {
    const msg = run([
      { type: 'text', delta: 'Let me check. ' },
      { type: 'tool_start', id: 't1', name: 'search_places', input: {} },
      { type: 'tool_end', id: 't1', name: 'search_places', ok: true, summary: '4 places in Huế' },
      { type: 'text', delta: 'Here you go.' },
      { type: 'done', stopReason: 'complete' },
    ]);
    expect(msg).toMatchObject({ text: 'Let me check. \n\nHere you go.', status: 'done' });
    expect(msg.tools).toEqual([{ id: 't1', name: 'search_places', status: 'ok', summary: '4 places in Huế' }]);
  });

  it('reset drops only the text of the turn being re-run', () => {
    const msg = run([
      { type: 'text', delta: 'Kept. ' },
      { type: 'tool_start', id: 't1', name: 'get_weather', input: {} },
      { type: 'tool_end', id: 't1', name: 'get_weather', ok: false, summary: 'Tool failed' },
      { type: 'text', delta: 'Half a turn' },
      { type: 'reset' },
      { type: 'text', delta: 'Final.' },
    ]);
    expect(msg.text).toBe('Kept. \n\nFinal.');
    expect(msg.tools[0]!.status).toBe('error');
  });

  it('does not add a paragraph break when the turn text already ends with one', () => {
    const msg = run([
      { type: 'text', delta: 'Intro\n' },
      { type: 'tool_start', id: 't1', name: 'search_places', input: {} },
      { type: 'text', delta: 'More' },
      { type: 'text', delta: ' text' },
    ]);
    expect(msg.text).toBe('Intro\nMore text');
  });

  it('hides partial text when the answer was refused', () => {
    const msg = run([{ type: 'text', delta: 'partial' }, { type: 'done', stopReason: 'refused' }]);
    expect(msg).toMatchObject({ text: '', status: 'refused' });
  });

  it('shows server errors', () => {
    expect(run([{ type: 'error', message: 'busy', retryable: true }])).toMatchObject({ status: 'error', error: 'busy' });
  });
});
