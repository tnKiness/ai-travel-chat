import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';
import { SseParser, type ChatEvent, type ChatRequest } from '@travel/shared';

/**
 * Where the API runs. Set EXPO_PUBLIC_API_URL for a phone on the LAN or a deployed server.
 * The Android emulator reaches the host machine at 10.0.2.2.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001');

export class ChatHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Posts a message and calls `onEvent` for every server-sent event until the stream ends. */
export async function streamChat(
  request: ChatRequest,
  onEvent: (event: ChatEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(request),
    signal,
  });
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ChatHttpError(res.status, body.error ?? `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    // stream: true keeps multi-byte characters (Vietnamese, emoji) intact across chunks.
    for (const event of parser.push(decoder.decode(value, { stream: true }))) onEvent(event);
  }
  for (const event of parser.push(decoder.decode())) onEvent(event);
}
