import { randomUUID } from 'node:crypto';
import type { MessageParam } from './model/types.js';

interface Conversation {
  messages: MessageParam[];
  busy: boolean;
  touchedAt: number;
}

export class ConversationBusyError extends Error {}
export class ConversationNotFoundError extends Error {}
export class ConversationFullError extends Error {}

export interface StoreOptions {
  maxConversations?: number;
  ttlMs?: number;
  maxMessages?: number;
  now?: () => number;
}

/**
 * In-memory conversation history with TTL and LRU eviction. History is only ever appended
 * to (never rewritten), which keeps prompt caching effective and satisfies the API's
 * checks on replayed thinking blocks. Swap for Redis/Postgres behind the same methods to
 * run more than one server instance.
 */
export class ConversationStore {
  private readonly items = new Map<string, Conversation>();
  private readonly max: number;
  private readonly ttl: number;
  private readonly maxMessages: number;
  private readonly now: () => number;

  constructor(opts: StoreOptions = {}) {
    this.max = opts.maxConversations ?? 1000;
    this.ttl = opts.ttlMs ?? 6 * 3600_000;
    this.maxMessages = opts.maxMessages ?? 200;
    this.now = opts.now ?? Date.now;
  }

  /**
   * Opens (or creates) a conversation for one agent run. Only one run per conversation
   * may be in flight; the caller must `release` or `commit` afterwards.
   */
  begin(id?: string): { id: string; history: MessageParam[] } {
    this.evictExpired();
    if (id) {
      const conv = this.items.get(id);
      if (!conv) throw new ConversationNotFoundError('Conversation expired, start a new one');
      if (conv.busy) throw new ConversationBusyError('Still answering the previous message');
      if (conv.messages.length >= this.maxMessages) throw new ConversationFullError('Conversation is too long, start a new one');
      conv.busy = true;
      conv.touchedAt = this.now();
      // Refresh LRU position.
      this.items.delete(id);
      this.items.set(id, conv);
      return { id, history: [...conv.messages] };
    }
    this.evictLeastRecentlyUsed();
    const newId = randomUUID();
    this.items.set(newId, { messages: [], busy: true, touchedAt: this.now() });
    return { id: newId, history: [] };
  }

  commit(id: string, newMessages: MessageParam[]): void {
    const conv = this.items.get(id);
    if (!conv) return;
    conv.messages.push(...newMessages);
    conv.busy = false;
    conv.touchedAt = this.now();
  }

  release(id: string): void {
    const conv = this.items.get(id);
    if (conv) conv.busy = false;
  }

  size(): number {
    return this.items.size;
  }

  private evictExpired(): void {
    const cutoff = this.now() - this.ttl;
    for (const [id, conv] of this.items) {
      if (!conv.busy && conv.touchedAt < cutoff) this.items.delete(id);
    }
  }

  /** Makes room for a new conversation. */
  private evictLeastRecentlyUsed(): void {
    // Map iteration order is insertion order, i.e. least recently used first.
    for (const [id, conv] of this.items) {
      if (this.items.size < this.max) break;
      if (!conv.busy) this.items.delete(id);
    }
  }
}
