import { setTimeout as sleep } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import {
  askForCity, composeDemoAnswer, isVietnamese, lookupIntro, planDemoReply, type DemoFindings,
} from '@travel/shared';
import type { ChatModel, ContentBlock, MessageParam, TurnRequest, TurnResult } from './types.js';

const FOOTER = { vi: 'Chế độ demo: đặt `ANTHROPIC_API_KEY` để trò chuyện với Claude.', en: 'Demo mode: set `ANTHROPIC_API_KEY` to chat with Claude.' };

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
    const vi = this.conversationIsVietnamese(messages);
    const toolResults = last && Array.isArray(last.content)
      ? last.content.filter((b) => b.type === 'tool_result')
      : [];

    if (toolResults.length > 0) {
      const text = composeDemoAnswer(this.findingsFrom(toolResults), vi, vi ? FOOTER.vi : FOOTER.en);
      await this.emit(text, onText, signal);
      return { content: [this.textBlock(text)], stop_reason: 'end_turn' };
    }

    const plan = planDemoReply(typeof last?.content === 'string' ? last.content : '', vi);
    if (!plan.city) {
      const text = askForCity(vi);
      await this.emit(text, onText, signal);
      return { content: [this.textBlock(text)], stop_reason: 'end_turn' };
    }

    const intro = lookupIntro(plan.city, vi);
    await this.emit(intro, onText, signal);
    const content: ContentBlock[] = [
      this.textBlock(intro),
      { type: 'tool_use', id: this.toolId(), name: 'search_places', input: { city: plan.city.name, limit: 4 } },
    ];
    if (plan.wantsWeather) {
      content.push({ type: 'tool_use', id: this.toolId(), name: 'get_weather', input: { city: plan.city.name, days: 3 } });
    }
    return { content, stop_reason: 'tool_use' };
  }

  private findingsFrom(results: { content?: unknown; is_error?: boolean }[]): DemoFindings {
    const findings: DemoFindings = { city: '', failures: 0 };
    for (const r of results) {
      if (r.is_error || typeof r.content !== 'string') {
        findings.failures! += 1;
        continue;
      }
      Object.assign(findings, JSON.parse(r.content) as Partial<DemoFindings>);
    }
    return findings;
  }

  private conversationIsVietnamese(messages: MessageParam[]): boolean {
    const firstUser = messages.find((m) => m.role === 'user' && typeof m.content === 'string');
    return isVietnamese(typeof firstUser?.content === 'string' ? firstUser.content : '');
  }

  private toolId(): string {
    return `toolu_${randomUUID().replace(/-/g, '')}`;
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
