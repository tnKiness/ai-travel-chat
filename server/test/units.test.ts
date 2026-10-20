import { describe, expect, it } from 'vitest';
import { ConversationBusyError, ConversationNotFoundError, ConversationStore } from '../src/conversations.js';
import { RateLimiter } from '../src/rate-limit.js';
import { findCity } from '../src/tools/places-data.js';
import { executeTool } from '../src/tools/index.js';
import { weatherFetch } from './helpers.js';

const ctx = { signal: new AbortController().signal, fetch: weatherFetch };

describe('findCity', () => {
  it.each(['Hội An', 'hoi an', 'HOIAN', 'hoi-an'])('matches %s', (q) => {
    expect(findCity(q)?.id).toBe('hoi-an');
  });
  it('matches aliases', () => {
    expect(findCity('Sài Gòn')?.id).toBe('ho-chi-minh');
    expect(findCity('Da Nang')?.id).toBe('da-nang');
  });
  it('returns undefined for unknown cities', () => {
    expect(findCity('Paris')).toBeUndefined();
  });
});

describe('tools', () => {
  it('filters places by category', async () => {
    const out = await executeTool('search_places', { city: 'Huế', category: 'food' }, ctx);
    const data = JSON.parse(out.content);
    expect(data.places.map((p: { id: string }) => p.id)).toEqual(['bun-bo-hue']);
  });

  it('turns weather API failures into a generic tool error', async () => {
    const failing: typeof fetch = async () => new Response('down', { status: 503 });
    const out = await executeTool('get_weather', { city: 'Huế' }, { ...ctx, fetch: failing });
    expect(out).toMatchObject({ isError: true, content: 'The tool is temporarily unavailable.' });
  });

  it('rejects unknown tools', async () => {
    expect(await executeTool('rm_rf', {}, ctx)).toMatchObject({ isError: true });
  });
});

describe('ConversationStore', () => {
  it('allows one run at a time per conversation', () => {
    const store = new ConversationStore();
    const { id } = store.begin();
    expect(() => store.begin(id)).toThrow(ConversationBusyError);
    store.commit(id, [{ role: 'user', content: 'hi' }]);
    expect(store.begin(id).history).toHaveLength(1);
  });

  it('expires idle conversations', () => {
    let now = 0;
    const store = new ConversationStore({ ttlMs: 1000, now: () => now });
    const { id } = store.begin();
    store.release(id);
    now = 2000;
    store.begin();
    expect(() => store.begin(id)).toThrow(ConversationNotFoundError);
  });

  it('evicts the least recently used conversation when full', () => {
    const store = new ConversationStore({ maxConversations: 2 });
    const a = store.begin().id; store.release(a);
    const b = store.begin().id; store.release(b);
    store.begin(a); store.release(a); // touch a
    store.begin();
    expect(() => store.begin(b)).toThrow(ConversationNotFoundError);
    expect(() => store.begin(a)).not.toThrow();
  });
});

describe('RateLimiter', () => {
  it('refills over time', () => {
    let now = 0;
    const limiter = new RateLimiter(1, 60, () => now);
    expect(limiter.take('ip')).toBe(0);
    expect(limiter.take('ip')).toBe(1);
    now = 1000;
    expect(limiter.take('ip')).toBe(0);
  });
});
