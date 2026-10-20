import { setTimeout as sleep } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { CITIES } from '../tools/places-data.js';
import type { ChatModel, ContentBlock, MessageParam, TurnRequest, TurnResult } from './types.js';

const strip = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/gi, 'd').toLowerCase();
const WEATHER_WORDS = ['weather', 'rain', 'pack', 'thoi tiet', 'mua', 'nong', 'lanh', 'mang gi'];

interface PlaceResult { name: string; summary: string; hours: number }
interface ForecastResult { date: string; minC: number; maxC: number; conditions: string }

/**
 * A deterministic stand-in for Claude: recognises a city in the user's message, calls the
 * real tools, then writes an answer from their results. Lets anyone run the full app —
 * streaming, tool calls, UI — without an API key, and gives the tests a predictable model.
 */
export class ScriptedModel implements ChatModel {
  readonly id = 'scripted-demo';

  constructor(private readonly chunkDelayMs = 15) {}

  async streamTurn({ messages }: TurnRequest, onText: (d: string) => void, signal: AbortSignal): Promise<TurnResult> {
    const last = messages.at(-1);
    const toolResults = last && Array.isArray(last.content)
      ? last.content.filter((b) => b.type === 'tool_result')
      : [];

    if (toolResults.length > 0) {
      const text = this.answerFromResults(toolResults, this.isVietnamese(messages));
      await this.emit(text, onText, signal);
      return { content: [this.textBlock(text)], stop_reason: 'end_turn' };
    }

    const userText = typeof last?.content === 'string' ? last.content : '';
    const vi = this.isVietnamese(messages);
    const q = strip(userText);
    const city = CITIES.find((c) => [c.name, ...c.aliases].some((n) => q.includes(strip(n))));
    if (!city) {
      const names = CITIES.map((c) => c.name).join(', ');
      const text = vi
        ? `Bạn muốn đi thành phố nào? Mình có thể gợi ý cho: ${names}.`
        : `Which city are you heading to? I can help with ${names}.`;
      await this.emit(text, onText, signal);
      return { content: [this.textBlock(text)], stop_reason: 'end_turn' };
    }

    const intro = vi ? `Để mình xem ${city.name} có gì hay nhé.` : `Let me look up ${city.name} for you.`;
    await this.emit(intro, onText, signal);
    const content: ContentBlock[] = [
      this.textBlock(intro),
      { type: 'tool_use', id: `toolu_${randomUUID().replace(/-/g, '')}`, name: 'search_places', input: { city: city.name, limit: 4 } },
    ];
    if (WEATHER_WORDS.some((w) => q.includes(w))) {
      content.push({ type: 'tool_use', id: `toolu_${randomUUID().replace(/-/g, '')}`, name: 'get_weather', input: { city: city.name, days: 3 } });
    }
    return { content, stop_reason: 'tool_use' };
  }

  private answerFromResults(results: { content?: unknown; is_error?: boolean }[], vi: boolean): string {
    const lines: string[] = [];
    for (const r of results) {
      if (r.is_error || typeof r.content !== 'string') {
        lines.push(vi ? '(Một công cụ đang lỗi, mình bỏ qua phần đó.)' : '(One lookup failed, so I skipped it.)');
        continue;
      }
      const data = JSON.parse(r.content) as { city: string; places?: PlaceResult[]; forecast?: ForecastResult[] };
      if (data.places) {
        lines.push(vi ? `**Gợi ý ở ${data.city}:**` : `**Ideas for ${data.city}:**`);
        for (const p of data.places) lines.push(`- **${p.name}** (~${p.hours}h) — ${p.summary}`);
      }
      if (data.forecast) {
        lines.push('', vi ? '**Thời tiết:**' : '**Weather:**');
        for (const f of data.forecast) lines.push(`- ${f.date}: ${f.minC}–${f.maxC}°C, ${f.conditions.toLowerCase()}`);
      }
    }
    lines.push('', vi ? 'Chế độ demo: đặt `ANTHROPIC_API_KEY` để trò chuyện với Claude.' : 'Demo mode: set `ANTHROPIC_API_KEY` to chat with Claude.');
    return lines.join('\n');
  }

  private isVietnamese(messages: MessageParam[]): boolean {
    const firstUser = messages.find((m) => m.role === 'user' && typeof m.content === 'string');
    const text = typeof firstUser?.content === 'string' ? firstUser.content : '';
    return /[ăâđêôơưàáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/i.test(text);
  }

  private textBlock(text: string): ContentBlock {
    return { type: 'text', text, citations: null };
  }

  private async emit(text: string, onText: (d: string) => void, signal: AbortSignal) {
    for (const piece of text.match(/\S+\s*/g) ?? []) {
      signal.throwIfAborted();
      onText(piece);
      if (this.chunkDelayMs) await sleep(this.chunkDelayMs, undefined, { signal });
    }
  }
}
