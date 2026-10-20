import type { City } from './places-data.js';

export interface DailyForecast {
  date: string;
  minC: number;
  maxC: number;
  rainChance: number | null;
  conditions: string;
}

/** WMO weather interpretation codes, grouped. */
function describe(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  return 'Thunderstorms';
}

interface OpenMeteoDaily {
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
    weather_code: number[];
  };
}

/** Free Open-Meteo forecast API — no key required. */
export async function fetchForecast(
  city: City,
  days: number,
  ctx: { signal: AbortSignal; fetch: typeof fetch },
): Promise<DailyForecast[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(city.lat),
    longitude: String(city.lon),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    timezone: 'Asia/Ho_Chi_Minh',
    forecast_days: String(days),
  }).toString();

  const res = await ctx.fetch(url, { signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(5000)]) });
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  const { daily } = (await res.json()) as OpenMeteoDaily;
  if (!daily) throw new Error('Open-Meteo response had no daily data');

  return daily.time.map((date, i) => ({
    date,
    minC: Math.round(daily.temperature_2m_min[i] ?? 0),
    maxC: Math.round(daily.temperature_2m_max[i] ?? 0),
    rainChance: daily.precipitation_probability_max[i] ?? null,
    conditions: describe(daily.weather_code[i] ?? 0),
  }));
}
