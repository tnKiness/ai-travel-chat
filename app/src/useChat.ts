import { useCallback, useRef, useState } from 'react';
import { ChatHttpError, streamChat } from './api';
import { applyEvent, type ChatMessage } from './chat-state';

export type { ChatMessage, ToolCall } from './chat-state';

let nextId = 0;
const newId = () => `m${++nextId}`;

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const conversationId = useRef<string | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);

  const update = (id: string, fn: (m: ChatMessage) => ChatMessage) =>
    setMessages((list) => list.map((m) => (m.id === id ? fn(m) : m)));

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || abort.current) return;
    const assistantId = newId();
    setMessages((list) => [
      ...list,
      { id: newId(), role: 'user', text: message, tools: [], status: 'done' },
      { id: assistantId, role: 'assistant', text: '', tools: [], status: 'streaming' },
    ]);
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    const textAtLastTool = { current: 0 };

    try {
      await streamChat(
        { conversationId: conversationId.current, message },
        (event) => {
          if (event.type === 'start') conversationId.current = event.conversationId;
          else update(assistantId, (m) => applyEvent(m, event, textAtLastTool));
        },
        ctrl.signal,
      );
      // Stream closed without a terminal event (e.g. server restarted).
      update(assistantId, (m) => (m.status === 'streaming' ? { ...m, status: 'error', error: 'Connection lost.' } : m));
    } catch (err) {
      if (ctrl.signal.aborted) {
        update(assistantId, (m) => ({ ...m, status: 'stopped' }));
      } else {
        if (err instanceof ChatHttpError && err.status === 404) conversationId.current = undefined;
        const error = err instanceof Error ? err.message : 'Could not reach the server.';
        update(assistantId, (m) => ({ ...m, status: 'error', error }));
      }
    } finally {
      abort.current = null;
      setBusy(false);
    }
  }, []);

  const stop = useCallback(() => abort.current?.abort(), []);

  const reset = useCallback(() => {
    abort.current?.abort();
    conversationId.current = undefined;
    setMessages([]);
  }, []);

  return { messages, busy, send, stop, reset };
}
