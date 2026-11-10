import { describe, expect, it } from 'vitest';
import type { ChatEvent } from '@travel/shared';
import { streamDemoChat } from '../src/demo';

const weather: typeof fetch = async () =>
  Response.json({
    daily: {
      time: ['2026-10-21'], temperature_2m_max: [28], temperature_2m_min: [21],
      precipitation_probability_max: [40], weather_code: [1],
    },
  });

async function run(message: string, fetchImpl: typeof fetch = weather) {
  const events: ChatEvent[] = [];
  await streamDemoChat({ message }, (e) => events.push(e), new AbortController().signal, { fetch: fetchImpl, delayMs: 0 });
  return events;
}

const text = (events: ChatEvent[]) => events.flatMap((e) => (e.type === 'text' ? [e.delta] : [])).join('');

describe('streamDemoChat', () => {
  it('emits the same event shape as the server', async () => {
    const events = await run('Đà Lạt thời tiết thế nào?');
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(['start', 'text', 'tool_start', 'tool_end', 'done']));
    expect(events.filter((e) => e.type === 'tool_end').map((e) => (e as { summary: string }).summary))
      .toEqual(['4 places in Đà Lạt', 'Đà Lạt: 21–28°C, partly cloudy today']);
    expect(text(events)).toMatch(/Gợi ý ở Đà Lạt/);
    expect(events.at(-1)).toEqual({ type: 'done', stopReason: 'complete' });
  });

  it('asks for a city when none is mentioned', async () => {
    const events = await run('Where should I go?');
    expect(text(events)).toMatch(/Which city/);
    expect(events.some((e) => e.type === 'tool_start')).toBe(false);
  });

  it('keeps answering when the weather service fails', async () => {
    const events = await run('Huế weather', async () => new Response('down', { status: 500 }));
    expect(events.find((e) => e.type === 'tool_end' && e.name === 'get_weather')).toMatchObject({ ok: false });
    expect(text(events)).toMatch(/One lookup failed/);
  });

  it('stops when aborted', async () => {
    const ctrl = new AbortController();
    const pending = streamDemoChat({ message: 'Hội An' }, () => ctrl.abort(), ctrl.signal, { delayMs: 5 });
    await expect(pending).rejects.toBeDefined();
  });
});
