import { CITIES, foldText, findCityInText, type City, type Place } from './places.js';
import type { DailyForecast } from './weather.js';

/**
 * Wording for the keyless demo. Used by the server's scripted model and by the in-browser
 * demo build, so both behave the same.
 */

const WEATHER_WORDS = ['weather', 'rain', 'pack', 'thoi tiet', 'mua', 'nong', 'lanh', 'mang gi'];
const VIETNAMESE_LETTERS = /[ăâđêôơưàáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/i;

export interface DemoPlan {
  vi: boolean;
  city?: City;
  wantsWeather: boolean;
}

export function planDemoReply(message: string, vi = VIETNAMESE_LETTERS.test(message)): DemoPlan {
  const q = foldText(message);
  return { vi, city: findCityInText(message), wantsWeather: WEATHER_WORDS.some((w) => q.includes(w)) };
}

export function isVietnamese(text: string): boolean {
  return VIETNAMESE_LETTERS.test(text);
}

export function askForCity(vi: boolean): string {
  const names = CITIES.map((c) => c.name).join(', ');
  return vi
    ? `Bạn muốn đi thành phố nào? Mình có thể gợi ý cho: ${names}.`
    : `Which city are you heading to? I can help with ${names}.`;
}

export function lookupIntro(city: City, vi: boolean): string {
  return vi ? `Để mình xem ${city.name} có gì hay nhé.` : `Let me look up ${city.name} for you.`;
}

export interface DemoFindings {
  city: string;
  places?: Pick<Place, 'name' | 'summary' | 'hours'>[];
  forecast?: DailyForecast[];
  failures?: number;
}

export function composeDemoAnswer(findings: DemoFindings, vi: boolean, footer: string): string {
  const lines: string[] = [];
  for (let i = 0; i < (findings.failures ?? 0); i++) {
    lines.push(vi ? '(Một công cụ đang lỗi, mình bỏ qua phần đó.)' : '(One lookup failed, so I skipped it.)');
  }
  if (findings.places) {
    lines.push(vi ? `**Gợi ý ở ${findings.city}:**` : `**Ideas for ${findings.city}:**`);
    for (const p of findings.places) lines.push(`- **${p.name}** (~${p.hours}h) — ${p.summary}`);
  }
  if (findings.forecast) {
    lines.push('', vi ? '**Thời tiết:**' : '**Weather:**');
    for (const f of findings.forecast) lines.push(`- ${f.date}: ${f.minC}–${f.maxC}°C, ${f.conditions.toLowerCase()}`);
  }
  lines.push('', footer);
  return lines.join('\n');
}
