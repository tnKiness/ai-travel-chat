import type { ChatEvent, ToolName } from '@travel/shared';

export interface ToolCall {
  id: string;
  name: ToolName;
  status: 'running' | 'ok' | 'error';
  summary?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  tools: ToolCall[];
  status: 'streaming' | 'done' | 'refused' | 'error' | 'stopped';
  error?: string;
}

/** Applies one server event to the assistant message being streamed. */
export function applyEvent(msg: ChatMessage, event: ChatEvent, textAtLastTool: { current: number }): ChatMessage {
  switch (event.type) {
    case 'text': {
      // The first text after a tool call starts a new model turn: begin a new paragraph.
      const newTurn = msg.tools.length > 0 && msg.text.length > 0 && textAtLastTool.current === msg.text.length;
      const sep = newTurn && !/\n\s*$/.test(msg.text) ? '\n\n' : '';
      return { ...msg, text: msg.text + sep + event.delta };
    }
    case 'reset':
      return { ...msg, text: msg.text.slice(0, textAtLastTool.current) };
    case 'tool_start':
      textAtLastTool.current = msg.text.length;
      return { ...msg, tools: [...msg.tools, { id: event.id, name: event.name, status: 'running' }] };
    case 'tool_end':
      textAtLastTool.current = msg.text.length;
      return {
        ...msg,
        tools: msg.tools.map((t) => (t.id === event.id ? { ...t, status: event.ok ? 'ok' : 'error', summary: event.summary } : t)),
      };
    case 'done':
      if (event.stopReason === 'refused') {
        // A declined answer may have streamed partially; don't show it as if it were complete.
        return { ...msg, text: '', status: 'refused', error: "I can't help with that request." };
      }
      if (event.stopReason === 'turn_limit') {
        return { ...msg, status: 'error', error: 'This question needed too many lookups. Try asking something more specific.' };
      }
      return { ...msg, status: 'done' };
    case 'error':
      return { ...msg, status: 'error', error: event.message };
    default:
      return msg;
  }
}
