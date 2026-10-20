import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SseParser, type ChatEvent } from '@travel/shared';
import { buildApp } from '../src/app.js';
import { ConversationStore } from '../src/conversations.js';
import { ScriptedModel } from '../src/model/scripted.js';
import { RateLimiter } from '../src/rate-limit.js';
import { FakeModel, text, weatherFetch } from './helpers.js';
import type { ChatModel } from '../src/model/types.js';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function start(model: ChatModel, extra: Partial<Parameters<typeof buildApp>[0]> = {}) {
  app = await buildApp({ model, fetch: weatherFetch, ...extra });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  return `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
}

async function chat(base: string, body: object): Promise<{ status: number; events: ChatEvent[]; json?: unknown }> {
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.headers.get('content-type')?.startsWith('text/event-stream')) {
    return { status: res.status, events: [], json: await res.json() };
  }
  const parser = new SseParser();
  const events = parser.push(await res.text());
  return { status: res.status, events };
}

describe('POST /api/chat', () => {
  it('streams a full tool-using answer with the scripted model', async () => {
    const base = await start(new ScriptedModel(0));
    const { status, events } = await chat(base, { message: 'Gợi ý đi Hội An, thời tiết thế nào?' });
    expect(status).toBe(200);
    const types = events.map((e) => e.type);
    expect(types[0]).toBe('start');
    expect(types).toContain('tool_start');
    expect(events.filter((e) => e.type === 'tool_end').map((e) => (e as { name: string }).name).sort())
      .toEqual(['get_weather', 'search_places']);
    expect(events.at(-1)).toEqual({ type: 'done', stopReason: 'complete' });
    const answer = events.filter((e) => e.type === 'text').map((e) => (e as { delta: string }).delta).join('');
    expect(answer).toMatch(/Hội An Ancient Town/);
    expect(answer).toMatch(/24–31°C/);
  });

  it('continues a conversation with its full history', async () => {
    const model = new FakeModel([
      { content: [text('first')], stop_reason: 'end_turn' },
      { content: [text('second')], stop_reason: 'end_turn' },
    ]);
    const base = await start(model);
    const first = await chat(base, { message: 'one' });
    const conversationId = (first.events[0] as { conversationId: string }).conversationId;
    await chat(base, { conversationId, message: 'two' });
    expect(model.requests[1]!.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('rejects a second message while the first is still streaming', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const model = new FakeModel([
      { content: [text('a')], stop_reason: 'end_turn' },
      async () => { await gate; return { content: [text('b')], stop_reason: 'end_turn' }; },
    ]);
    const base = await start(model);
    const first = await chat(base, { message: 'one' });
    const conversationId = (first.events[0] as { conversationId: string }).conversationId;
    const slow = chat(base, { conversationId, message: 'two' });
    await new Promise((r) => setTimeout(r, 50));
    const busy = await chat(base, { conversationId, message: 'three' });
    expect(busy.status).toBe(409);
    release();
    expect((await slow).events.at(-1)).toEqual({ type: 'done', stopReason: 'complete' });
  });

  it('aborts the model call when the client disconnects, and keeps no partial turn', async () => {
    let aborted = false;
    const store = new ConversationStore();
    const model = new FakeModel([
      (signal) => new Promise((_, reject) => {
        signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); });
      }),
      { content: [text('fresh')], stop_reason: 'end_turn' },
    ]);
    const base = await start(model, { store });
    const ctrl = new AbortController();
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'hi' }), signal: ctrl.signal,
    });
    const reader = res.body!.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    const conversationId = (new SseParser().push(first)[0] as { conversationId: string }).conversationId;
    ctrl.abort();
    await new Promise((r) => setTimeout(r, 100));
    expect(aborted).toBe(true);

    // The conversation is usable again and has no trace of the aborted run.
    await chat(base, { conversationId, message: 'again' });
    expect(model.requests[1]!.messages).toEqual([{ role: 'user', content: 'again' }]);
  });

  it('validates input and unknown conversations', async () => {
    const base = await start(new ScriptedModel(0));
    expect((await chat(base, { message: '   ' })).status).toBe(400);
    expect((await chat(base, { message: 'x'.repeat(2001) })).status).toBe(400);
    expect((await chat(base, { conversationId: crypto.randomUUID(), message: 'hi' })).status).toBe(404);
  });

  it('rate-limits per client', async () => {
    const base = await start(new ScriptedModel(0), { limiter: new RateLimiter(2, 1) });
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await chat(base, { message: 'hi' })).status);
    expect(statuses).toEqual([200, 200, 429]);
  });

  it('sends a safe error event when the model fails', async () => {
    const base = await start(new FakeModel([new Error('boom: secret detail')]));
    const { events } = await chat(base, { message: 'hi' });
    expect(events.at(-1)).toEqual({ type: 'error', message: 'Something went wrong while answering.', retryable: true });
  });
});
