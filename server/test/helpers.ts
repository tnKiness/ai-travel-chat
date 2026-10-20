import type { ChatEvent } from '@travel/shared';
import type { ChatModel, ContentBlock, TurnRequest, TurnResult } from '../src/model/types.js';

/** A model that replays a fixed list of turns and records what it was sent. */
export class FakeModel implements ChatModel {
  readonly id = 'fake';
  readonly requests: TurnRequest[] = [];
  private i = 0;

  constructor(private readonly turns: (TurnResult | Error | ((signal: AbortSignal) => Promise<TurnResult>))[]) {}

  async streamTurn(request: TurnRequest, onText: (d: string) => void, signal: AbortSignal): Promise<TurnResult> {
    this.requests.push(structuredClone(request));
    const next = this.turns[this.i++];
    if (!next) throw new Error('FakeModel ran out of turns');
    if (next instanceof Error) throw next;
    const turn = typeof next === 'function' ? await next(signal) : next;
    for (const b of turn.content) if (b.type === 'text') onText(b.text);
    return turn;
  }
}

export const text = (t: string): ContentBlock => ({ type: 'text', text: t, citations: null });
export const toolUse = (id: string, name: string, input: unknown): ContentBlock =>
  ({ type: 'tool_use', id, name, input }) as ContentBlock;

/** fetch stub for Open-Meteo. */
export const weatherFetch: typeof fetch = async () =>
  Response.json({
    daily: {
      time: ['2026-10-21', '2026-10-22'],
      temperature_2m_max: [31.4, 29.6],
      temperature_2m_min: [24.2, 23.8],
      precipitation_probability_max: [60, 85],
      weather_code: [2, 63],
    },
  });

export function collect() {
  const events: ChatEvent[] = [];
  return { events, emit: (e: ChatEvent) => events.push(e) };
}
