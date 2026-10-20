import type Anthropic from '@anthropic-ai/sdk';

export type MessageParam = Anthropic.Beta.Messages.BetaMessageParam;
export type ContentBlock = Anthropic.Beta.Messages.BetaContentBlock;

/** The parts of a model response the agent loop needs. */
export type TurnResult = Pick<Anthropic.Beta.Messages.BetaMessage, 'content' | 'stop_reason'>;

export interface TurnRequest {
  system: string;
  messages: MessageParam[];
  tools: Anthropic.Beta.BetaTool[];
}

/**
 * One streamed model turn. Implemented by Claude for real use and by a scripted model
 * for offline demos and deterministic tests.
 */
export interface ChatModel {
  readonly id: string;
  streamTurn(request: TurnRequest, onText: (delta: string) => void, signal: AbortSignal): Promise<TurnResult>;
}
