import Anthropic from '@anthropic-ai/sdk';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { encodeEvent, MAX_MESSAGE_LENGTH, type ChatEvent } from '@travel/shared';
import { runAgent } from './agent.js';
import {
  ConversationBusyError, ConversationFullError, ConversationNotFoundError, ConversationStore,
} from './conversations.js';
import type { ChatModel } from './model/types.js';
import { RateLimiter } from './rate-limit.js';

export interface AppDeps {
  model: ChatModel;
  store?: ConversationStore;
  limiter?: RateLimiter;
  corsOrigin?: string[] | boolean;
  fetch?: typeof fetch;
  heartbeatMs?: number;
  logger?: boolean;
}

const chatBody = z.object({
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

/** Maps failures to a message that is safe to show and whether retrying may help. */
function describeError(err: unknown): { message: string; retryable: boolean } {
  if (err instanceof Anthropic.RateLimitError) return { message: 'The assistant is busy, please try again shortly.', retryable: true };
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return { message: 'The server is not configured correctly.', retryable: false };
  }
  if (err instanceof Anthropic.APIConnectionError || err instanceof Anthropic.InternalServerError) {
    return { message: 'Could not reach the assistant, please try again.', retryable: true };
  }
  return { message: 'Something went wrong while answering.', retryable: true };
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.logger ?? false, trustProxy: true });
  const store = deps.store ?? new ConversationStore();
  const limiter = deps.limiter ?? new RateLimiter(10, 20);
  await app.register(cors, { origin: deps.corsOrigin ?? true });

  app.get('/api/health', async () => ({ ok: true, model: deps.model.id }));

  app.post('/api/chat', async (req, reply) => {
    const body = chatBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0]?.message ?? 'Invalid request' });

    const wait = limiter.take(req.ip);
    if (wait > 0) return reply.status(429).header('retry-after', wait).send({ error: 'Too many messages, slow down a little.' });

    let conv: { id: string; history: Parameters<ConversationStore['commit']>[1] };
    try {
      conv = store.begin(body.data.conversationId);
    } catch (err) {
      if (err instanceof ConversationNotFoundError) return reply.status(404).send({ error: err.message });
      if (err instanceof ConversationBusyError) return reply.status(409).send({ error: err.message });
      if (err instanceof ConversationFullError) return reply.status(409).send({ error: err.message });
      throw err;
    }

    // From here on we own the raw socket and stream Server-Sent Events.
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      ...(reply.getHeaders() as Record<string, string>),
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no', // disable proxy buffering (nginx)
    });

    const abort = new AbortController();
    let finished = false;
    res.on('close', () => {
      if (!finished) abort.abort(new Error('Client disconnected'));
    });
    const send = (event: ChatEvent) => {
      if (!res.writableEnded) res.write(encodeEvent(event));
    };
    const heartbeat = setInterval(() => res.write(': ping\n\n'), deps.heartbeatMs ?? 15_000);

    send({ type: 'start', conversationId: conv.id });
    try {
      const result = await runAgent({
        model: deps.model,
        history: conv.history,
        userMessage: body.data.message,
        emit: send,
        signal: abort.signal,
        fetch: deps.fetch,
      });
      if (result.newMessages.length) store.commit(conv.id, result.newMessages);
      else store.release(conv.id);
      send({ type: 'done', stopReason: result.reason });
    } catch (err) {
      store.release(conv.id);
      if (!abort.signal.aborted) {
        req.log.error({ err }, 'chat run failed');
        send({ type: 'error', ...describeError(err) });
      }
    } finally {
      finished = true;
      clearInterval(heartbeat);
      res.end();
    }
  });

  return app;
}
