import {
  askForCity, composeDemoAnswer, fetchForecast, isVietnamese, lookupIntro, planDemoReply,
  type ChatEvent, type ChatRequest, type DailyForecast,
} from '@travel/shared';

/** Set at build time for the GitHub Pages demo, which has no server behind it. */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO === '1';

const FOOTER = {
  vi: 'Bản demo chạy trong trình duyệt — không có server hay AI. Chạy dự án ở máy với `ANTHROPIC_API_KEY` để trò chuyện với Claude.',
  en: 'Browser demo — no server or AI model. Run the project locally with `ANTHROPIC_API_KEY` to chat with Claude.',
};

const languageByConversation = new Map<string, boolean>();

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); }, { once: true });
  });
}

/**
 * Emits the same event stream as the real server, generated in the browser: the curated
 * places data, live weather straight from Open-Meteo, and the scripted demo wording.
 */
export async function streamDemoChat(
  request: ChatRequest,
  onEvent: (event: ChatEvent) => void,
  signal: AbortSignal,
  opts: { fetch?: typeof fetch; delayMs?: number } = {},
): Promise<void> {
  const delay = opts.delayMs ?? 25;
  const conversationId = request.conversationId ?? `demo-${Math.random().toString(36).slice(2)}`;
  if (!languageByConversation.has(conversationId)) languageByConversation.set(conversationId, isVietnamese(request.message));
  const vi = languageByConversation.get(conversationId)!;
  onEvent({ type: 'start', conversationId });

  const say = async (text: string) => {
    for (const piece of text.match(/\S+\s*/g) ?? []) {
      await wait(delay, signal);
      onEvent({ type: 'text', delta: piece });
    }
  };

  const plan = planDemoReply(request.message, vi);
  if (!plan.city) {
    await say(askForCity(vi));
    onEvent({ type: 'done', stopReason: 'complete' });
    return;
  }
  const city = plan.city;
  await say(lookupIntro(city, vi));

  const places = city.places.slice(0, 4);
  onEvent({ type: 'tool_start', id: 'demo-places', name: 'search_places', input: { city: city.name, limit: 4 } });
  await wait(delay * 16, signal);
  onEvent({ type: 'tool_end', id: 'demo-places', name: 'search_places', ok: true, summary: `${places.length} places in ${city.name}` });

  let forecast: DailyForecast[] | undefined;
  let failures = 0;
  if (plan.wantsWeather) {
    onEvent({ type: 'tool_start', id: 'demo-weather', name: 'get_weather', input: { city: city.name, days: 3 } });
    try {
      forecast = await fetchForecast(city, 3, { signal, fetch: opts.fetch ?? fetch });
      const today = forecast[0];
      onEvent({
        type: 'tool_end', id: 'demo-weather', name: 'get_weather', ok: true,
        summary: today ? `${city.name}: ${today.minC}–${today.maxC}°C, ${today.conditions.toLowerCase()} today` : `No forecast for ${city.name}`,
      });
    } catch (err) {
      if (signal.aborted) throw err;
      failures++;
      onEvent({ type: 'tool_end', id: 'demo-weather', name: 'get_weather', ok: false, summary: 'Weather service unavailable' });
    }
  }

  await say(composeDemoAnswer({ city: city.name, places, forecast, failures }, vi, vi ? FOOTER.vi : FOOTER.en));
  onEvent({ type: 'done', stopReason: 'complete' });
}
