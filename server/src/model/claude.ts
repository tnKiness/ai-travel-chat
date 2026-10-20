import Anthropic from '@anthropic-ai/sdk';
import type { ChatModel, TurnRequest, TurnResult } from './types.js';

export interface ClaudeOptions {
  model: string;
  effort: 'low' | 'medium' | 'high';
  client?: Anthropic;
}

export class ClaudeModel implements ChatModel {
  readonly id: string;
  private readonly client: Anthropic;

  constructor(private readonly opts: ClaudeOptions) {
    this.id = opts.model;
    // Credentials resolve from ANTHROPIC_API_KEY (or an `ant auth login` profile).
    this.client = opts.client ?? new Anthropic();
  }

  async streamTurn(request: TurnRequest, onText: (delta: string) => void, signal: AbortSignal): Promise<TurnResult> {
    const stream = this.client.beta.messages.stream(
      {
        model: this.opts.model,
        max_tokens: 64000,
        system: request.system,
        tools: request.tools,
        messages: request.messages,
        output_config: { effort: this.opts.effort },
        // Caches tools + system + history; only the newest turn is re-processed.
        cache_control: { type: 'ephemeral' },
        // If a safety classifier declines, the API retries on Anthropic's recommended
        // fallback model inside the same stream instead of returning a refusal.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      },
      { signal },
    );
    stream.on('text', onText);
    return stream.finalMessage();
  }
}
