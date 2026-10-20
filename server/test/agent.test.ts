import { describe, expect, it } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { echoableContent, runAgent } from '../src/agent.js';
import type { ContentBlock } from '../src/model/types.js';
import { collect, FakeModel, text, toolUse, weatherFetch } from './helpers.js';

const signal = new AbortController().signal;

describe('runAgent', () => {
  it('answers directly when no tool is needed', async () => {
    const model = new FakeModel([{ content: [text('Xin chào!')], stop_reason: 'end_turn' }]);
    const { events, emit } = collect();
    const result = await runAgent({ model, history: [], userMessage: 'chào', emit, signal });
    expect(result.reason).toBe('complete');
    expect(result.newMessages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(events).toEqual([{ type: 'text', delta: 'Xin chào!' }]);
  });

  it('runs parallel tools and returns all results in one user message', async () => {
    const model = new FakeModel([
      {
        content: [text('Checking…'), toolUse('t1', 'search_places', { city: 'Hoi An', limit: 2 }), toolUse('t2', 'get_weather', { city: 'hội an', days: 2 })],
        stop_reason: 'tool_use',
      },
      { content: [text('Here is your plan.')], stop_reason: 'end_turn' },
    ]);
    const { events, emit } = collect();
    const result = await runAgent({ model, history: [], userMessage: 'Hội An 2 days', emit, signal, fetch: weatherFetch });

    expect(result.reason).toBe('complete');
    expect(result.newMessages.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    const toolMessage = result.newMessages[2]!;
    expect(Array.isArray(toolMessage.content) && toolMessage.content.map((b) => b.type)).toEqual(['tool_result', 'tool_result']);

    const ends = events.filter((e) => e.type === 'tool_end');
    expect(ends).toEqual([
      { type: 'tool_end', id: 't1', name: 'search_places', ok: true, summary: '2 places in Hội An' },
      { type: 'tool_end', id: 't2', name: 'get_weather', ok: true, summary: 'Hội An: 24–31°C, partly cloudy today' },
    ]);
    // Second model call sees the tool results.
    expect(model.requests[1]!.messages).toHaveLength(3);
  });

  it('reports tool failures to the model instead of crashing', async () => {
    const model = new FakeModel([
      { content: [toolUse('t1', 'search_places', { city: 'Atlantis' }), toolUse('t2', 'search_places', { limit: 99 })], stop_reason: 'tool_use' },
      { content: [text('Sorry, I only know these cities.')], stop_reason: 'end_turn' },
    ]);
    const { emit } = collect();
    const result = await runAgent({ model, history: [], userMessage: 'Atlantis', emit, signal });
    const results = result.newMessages[2]!.content as Anthropic.Beta.BetaToolResultBlockParam[];
    expect(results.every((r) => r.is_error)).toBe(true);
    expect(String(results[0]!.content)).toMatch(/Unknown city "Atlantis"/);
    expect(String(results[1]!.content)).toMatch(/Invalid input: city/);
  });

  it('discards the run when the model refuses', async () => {
    const model = new FakeModel([{ content: [text('partial')], stop_reason: 'refusal' }]);
    const { emit } = collect();
    const result = await runAgent({ model, history: [], userMessage: 'x', emit, signal });
    expect(result).toEqual({ reason: 'refused', newMessages: [] });
  });

  it('never runs tool calls truncated by max_tokens', async () => {
    const model = new FakeModel([{ content: [toolUse('t1', 'search_places', { city: 'Hu' })], stop_reason: 'max_tokens' }]);
    const { events, emit } = collect();
    await expect(runAgent({ model, history: [], userMessage: 'x', emit, signal })).rejects.toThrow(/truncated/);
    expect(events.some((e) => e.type === 'tool_start')).toBe(false);
  });

  it('caps tool rounds: returns "budget spent" results, then stops', async () => {
    const loop = { content: [toolUse('t', 'search_places', { city: 'Huế' })], stop_reason: 'tool_use' as const };
    const model = new FakeModel(Array.from({ length: 10 }, () => structuredClone(loop)));
    const { events, emit } = collect();
    const result = await runAgent({ model, history: [], userMessage: 'x', emit, signal, maxToolRounds: 2 });
    expect(result).toEqual({ reason: 'turn_limit', newMessages: [] });
    expect(events.filter((e) => e.type === 'tool_start')).toHaveLength(2);
    const last = model.requests.at(-1)!.messages.at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[];
    expect(last[0]).toMatchObject({ is_error: true, content: expect.stringMatching(/budget/) });
  });

  it('re-issues a turn whose tool input failed to parse, and tells the UI to reset', async () => {
    const model = new FakeModel([new SyntaxError('Unexpected end of JSON input'), { content: [text('ok')], stop_reason: 'end_turn' }]);
    const { events, emit } = collect();
    const result = await runAgent({ model, history: [], userMessage: 'x', emit, signal });
    expect(result.reason).toBe('complete');
    expect(events[0]).toEqual({ type: 'reset' });
  });

  it('propagates API errors without retrying', async () => {
    const apiError = new Anthropic.RateLimitError(429, { type: 'error' }, 'rate limited', new Headers());
    const model = new FakeModel([apiError, { content: [text('never')], stop_reason: 'end_turn' }]);
    const { emit } = collect();
    await expect(runAgent({ model, history: [], userMessage: 'x', emit, signal })).rejects.toBe(apiError);
    expect(model.requests).toHaveLength(1);
  });

  it('keeps earlier history untouched (append-only)', async () => {
    const history = [
      { role: 'user' as const, content: 'first' },
      { role: 'assistant' as const, content: [text('first answer')] },
    ];
    const snapshot = structuredClone(history);
    const model = new FakeModel([{ content: [text('second answer')], stop_reason: 'end_turn' }]);
    await runAgent({ model, history, userMessage: 'second', emit: () => undefined, signal });
    expect(history).toEqual(snapshot);
    expect(model.requests[0]!.messages.slice(0, 2)).toEqual(snapshot);
  });
});

describe('echoableContent', () => {
  it('drops non-text blocks the declined model produced before a fallback marker', () => {
    const fallback = { type: 'fallback', from: { model: 'a' }, to: { model: 'b' } } as unknown as ContentBlock;
    const content = [
      { type: 'thinking', thinking: '', signature: 's' } as ContentBlock,
      text('partial '),
      toolUse('t0', 'search_places', { city: 'Huế' }),
      fallback,
      text('continued'),
      toolUse('t1', 'get_weather', { city: 'Huế' }),
    ];
    expect(echoableContent(content).map((b) => b.type)).toEqual(['text', 'fallback', 'text', 'tool_use']);
  });

  it('returns content unchanged when there was no fallback', () => {
    const content = [text('a'), toolUse('t', 'search_places', {})];
    expect(echoableContent(content)).toBe(content);
  });
});
