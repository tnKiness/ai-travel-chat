import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { ToolName } from '@travel/shared';
import { CITIES, findCity, type PlaceCategory } from './places-data.js';
import { fetchForecast } from './weather.js';

export interface ToolContext {
  signal: AbortSignal;
  fetch: typeof fetch;
}

export interface ToolOutput {
  /** JSON sent back to the model. */
  content: string;
  /** One-line, human-readable result shown in the chat UI. */
  summary: string;
}

/** A failure the model should see and recover from (unknown city, bad arguments…). */
export class ToolError extends Error {}

export interface Tool<I> {
  name: ToolName;
  definition: Anthropic.Beta.BetaTool;
  input: z.ZodType<I>;
  run(input: I, ctx: ToolContext): Promise<ToolOutput>;
}

const cityList = CITIES.map((c) => c.name).join(', ');
const CATEGORIES = ['sight', 'food', 'nature', 'culture', 'nightlife'] as const satisfies readonly PlaceCategory[];

const searchPlacesInput = z.object({
  city: z.string().min(1),
  category: z.enum(CATEGORIES).optional(),
  limit: z.number().int().min(1).max(10).optional(),
});

const searchPlaces: Tool<z.infer<typeof searchPlacesInput>> = {
  name: 'search_places',
  definition: {
    name: 'search_places',
    description:
      `Look up curated places to visit in a Vietnamese city. Supported cities: ${cityList}. ` +
      'Returns name, category, a short description and a typical visit length in hours. ' +
      'Use it before recommending specific places; do not invent places that are not returned.',
    eager_input_streaming: true,
    input_schema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name, e.g. "Hội An" or "Da Nang"' },
        category: { type: 'string', enum: [...CATEGORIES], description: 'Optional filter' },
        limit: { type: 'integer', minimum: 1, maximum: 10, description: 'Max results (default 6)' },
      },
      required: ['city'],
      additionalProperties: false,
    },
  },
  input: searchPlacesInput,
  async run({ city, category, limit = 6 }) {
    const found = findCity(city);
    if (!found) throw new ToolError(`Unknown city "${city}". Supported cities: ${cityList}.`);
    const places = found.places.filter((p) => !category || p.category === category).slice(0, limit);
    return {
      content: JSON.stringify({ city: found.name, places }),
      summary: `${places.length} place${places.length === 1 ? '' : 's'} in ${found.name}`,
    };
  },
};

const getWeatherInput = z.object({
  city: z.string().min(1),
  days: z.number().int().min(1).max(7).optional(),
});

const getWeather: Tool<z.infer<typeof getWeatherInput>> = {
  name: 'get_weather',
  definition: {
    name: 'get_weather',
    description:
      `Daily weather forecast (up to 7 days from today) for a Vietnamese city. Supported cities: ${cityList}. ` +
      'Use it when the user asks about weather or what to pack, or when planning outdoor activities.',
    eager_input_streaming: true,
    input_schema: {
      type: 'object',
      properties: {
        city: { type: 'string' },
        days: { type: 'integer', minimum: 1, maximum: 7, description: 'Number of days (default 3)' },
      },
      required: ['city'],
      additionalProperties: false,
    },
  },
  input: getWeatherInput,
  async run({ city, days = 3 }, ctx) {
    const found = findCity(city);
    if (!found) throw new ToolError(`Unknown city "${city}". Supported cities: ${cityList}.`);
    const forecast = await fetchForecast(found, days, ctx);
    const first = forecast[0];
    return {
      content: JSON.stringify({ city: found.name, forecast }),
      summary: first
        ? `${found.name}: ${first.minC}–${first.maxC}°C, ${first.conditions.toLowerCase()} today`
        : `No forecast for ${found.name}`,
    };
  },
};

// Order is fixed so the tool list (and therefore the prompt cache prefix) is stable.
export const TOOLS = [searchPlaces, getWeather] as const;
export const TOOL_DEFINITIONS: Anthropic.Beta.BetaTool[] = TOOLS.map((t) => t.definition);

/** Validates model-supplied input, runs the tool, and maps failures to a tool_result the model can read. */
export async function executeTool(
  name: string,
  rawInput: unknown,
  ctx: ToolContext,
): Promise<ToolOutput & { isError: boolean }> {
  const tool = TOOLS.find((t) => t.name === name) as Tool<unknown> | undefined;
  if (!tool) return { content: `Unknown tool "${name}"`, summary: 'Unknown tool', isError: true };
  // With eager input streaming the API does not validate inputs, so validate here.
  const parsed = tool.input.safeParse(rawInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      content: `Invalid input: ${issue?.path.join('.') || 'input'} ${issue?.message ?? ''}`.trim(),
      summary: 'Invalid input',
      isError: true,
    };
  }
  try {
    return { ...(await tool.run(parsed.data, ctx)), isError: false };
  } catch (err) {
    if (ctx.signal.aborted) throw err;
    const message = err instanceof ToolError ? err.message : 'The tool is temporarily unavailable.';
    return { content: message, summary: err instanceof ToolError ? message : 'Tool failed', isError: true };
  }
}
