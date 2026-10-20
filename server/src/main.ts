import { buildApp } from './app.js';
import { ClaudeModel } from './model/claude.js';
import { ScriptedModel } from './model/scripted.js';
import type { ChatModel } from './model/types.js';

const env = process.env;
const useClaude = env.CHAT_MODEL ? env.CHAT_MODEL !== 'scripted' : Boolean(env.ANTHROPIC_API_KEY);

const model: ChatModel = useClaude
  ? new ClaudeModel({
      model: env.CLAUDE_MODEL ?? 'claude-opus-5-5',
      effort: (env.CLAUDE_EFFORT as 'low' | 'medium' | 'high' | undefined) ?? 'medium',
    })
  : new ScriptedModel();

const app = await buildApp({
  model,
  corsOrigin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',').map((o) => o.trim()) : true,
  logger: true,
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => void app.close());

await app.listen({ host: env.HOST ?? '127.0.0.1', port: Number(env.PORT ?? 3001) });
app.log.info(`model: ${model.id}${useClaude ? '' : ' (no ANTHROPIC_API_KEY — offline demo model)'}`);
