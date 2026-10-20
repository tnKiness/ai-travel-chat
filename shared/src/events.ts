/** Server-sent events streamed by POST /api/chat. Shared by the server and the app. */
export type ChatEvent =
  | { type: 'start'; conversationId: string }
  | { type: 'text'; delta: string }
  /** Discard text streamed since the last tool call: that model turn is being re-run. */
  | { type: 'reset' }
  | { type: 'tool_start'; id: string; name: ToolName; input: unknown }
  | { type: 'tool_end'; id: string; name: ToolName; ok: boolean; summary: string }
  | { type: 'done'; stopReason: DoneReason }
  | { type: 'error'; message: string; retryable: boolean };

export type ToolName = 'search_places' | 'get_weather';

/**
 * - `complete`: the assistant finished its answer.
 * - `refused`: the model declined (after any server-side fallback).
 * - `turn_limit`: the agent hit its tool-call budget and stopped.
 */
export type DoneReason = 'complete' | 'refused' | 'turn_limit';

export interface ChatRequest {
  /** Omit to start a new conversation. */
  conversationId?: string;
  message: string;
}

export const MAX_MESSAGE_LENGTH = 2000;
