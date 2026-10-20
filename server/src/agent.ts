import Anthropic from '@anthropic-ai/sdk';
import type { ChatEvent, DoneReason } from '@travel/shared';
import { executeTool, TOOL_DEFINITIONS } from './tools/index.js';
import type { ChatModel, ContentBlock, MessageParam, TurnResult } from './model/types.js';

export const SYSTEM_PROMPT = `You are a friendly local travel assistant for Vietnam.

- Reply in the language the user writes in (Vietnamese or English).
- Recommend only places returned by the search_places tool, and use get_weather for anything weather-related. If a city is not supported, say so and list the supported ones.
- Do not state opening hours, ticket prices or schedules: the tools do not provide them, so suggest checking locally instead.
- When asked for an itinerary, group nearby places into realistic days using each place's visit length, and mention one local dish per day.
- Keep answers concise and skimmable: short paragraphs and bullet lists, no long preambles.`;

export interface AgentOptions {
  model: ChatModel;
  history: MessageParam[];
  userMessage: string;
  emit: (event: ChatEvent) => void;
  signal: AbortSignal;
  fetch?: typeof fetch;
  /** Rounds of tool calls allowed before the model must answer with what it has. */
  maxToolRounds?: number;
}

export interface AgentResult {
  reason: DoneReason;
  /** Messages to append to the conversation. Empty when the run must not be kept. */
  newMessages: MessageParam[];
}

const TOOL_BUDGET_SPENT = 'Tool budget for this answer is used up. Answer now with the information you already have.';

/**
 * After a mid-stream server-side fallback, blocks the declined model produced before the
 * last `fallback` marker must not be sent back, except text. (Claude API refusal docs.)
 */
export function echoableContent(content: ContentBlock[]): ContentBlock[] {
  const boundary = content.findLastIndex((b) => b.type === 'fallback');
  if (boundary === -1) return content;
  return content.filter((b, i) => i >= boundary || b.type === 'text');
}

/**
 * Manual agent loop: stream a model turn, run any requested tools in parallel, feed the
 * results back, repeat until the model answers. History is append-only and committed
 * only when the whole run succeeds, so an aborted or failed run leaves no half-turns.
 */
export async function runAgent(opts: AgentOptions): Promise<AgentResult> {
  const { model, emit, signal } = opts;
  const maxRounds = opts.maxToolRounds ?? 4;
  const added: MessageParam[] = [{ role: 'user', content: opts.userMessage }];
  const messages = (): MessageParam[] => [...opts.history, ...added];
  let toolRounds = 0;
  let parseRetries = 0;

  for (;;) {
    let turn: TurnResult;
    try {
      turn = await model.streamTurn(
        { system: SYSTEM_PROMPT, messages: messages(), tools: TOOL_DEFINITIONS },
        (delta) => emit({ type: 'text', delta }),
        signal,
      );
      parseRetries = 0;
    } catch (err) {
      // With eager input streaming, an unparseable tool input rejects finalMessage().
      // Re-issue that turn a couple of times; API errors and aborts propagate.
      if (err instanceof Anthropic.APIError || signal.aborted || parseRetries++ >= 2) throw err;
      emit({ type: 'reset' });
      continue;
    }

    // Declined by the whole fallback chain: discard the partial answer and the run.
    if (turn.stop_reason === 'refusal') return { reason: 'refused', newMessages: [] };

    const content = echoableContent(turn.content);
    const toolUses = content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');

    if (turn.stop_reason === 'pause_turn') {
      added.push({ role: 'assistant', content });
      continue;
    }
    if (turn.stop_reason === 'max_tokens' && toolUses.length > 0) {
      // A tool input cut off at max_tokens can still parse; never run it.
      throw new Error('Tool input was truncated by max_tokens');
    }
    if (turn.stop_reason !== 'tool_use' || toolUses.length === 0) {
      added.push({ role: 'assistant', content });
      return { reason: 'complete', newMessages: added };
    }

    if (toolRounds >= maxRounds + 1) {
      // The model ignored the "budget spent" results and kept calling tools.
      return { reason: 'turn_limit', newMessages: [] };
    }
    added.push({ role: 'assistant', content });
    const budgetSpent = toolRounds++ >= maxRounds;

    // Run this turn's tools concurrently; return every result in ONE user message.
    const results = await Promise.all(
      toolUses.map(async (use): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        if (budgetSpent) {
          return { type: 'tool_result', tool_use_id: use.id, content: TOOL_BUDGET_SPENT, is_error: true };
        }
        const name = use.name as Extract<ChatEvent, { type: 'tool_start' }>['name'];
        emit({ type: 'tool_start', id: use.id, name, input: use.input });
        const out = await executeTool(use.name, use.input, { signal, fetch: opts.fetch ?? fetch });
        emit({ type: 'tool_end', id: use.id, name, ok: !out.isError, summary: out.summary });
        return { type: 'tool_result', tool_use_id: use.id, content: out.content, is_error: out.isError };
      }),
    );
    added.push({ role: 'user', content: results });
  }
}
