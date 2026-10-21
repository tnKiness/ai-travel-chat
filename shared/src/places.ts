export type PlaceCategory = 'sight' | 'food' | 'nature' | 'culture' | 'nightlife';

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  summary: string;
  /** Rough visit length, used by the model when building a day plan. */
  hours: number;
  tags: string[];
}

export interface City {
  id: string;
  name: string;
  aliases: string[];
  lat: number;
  lon: number;
  places: Place[];
}

/**
 * Small curated dataset so the demo works offline. In production this would come from
 * a places database or API; the tool interface stays the same.
 */
export const CITIES: City[] = [
  {
    id: 'ha-noi', name: 'Hà Nội', aliases: ['hanoi', 'ha noi', 'hà nội'], lat: 21.0285, lon: 105.8542,
    places: [
      { id: 'hoan-kiem', name: 'Hoàn Kiếm Lake & Ngọc Sơn Temple', category: 'sight', summary: 'Lake at the heart of the Old Quarter with a red bridge leading to a small temple; lively on weekend evenings when nearby streets are pedestrian-only.', hours: 1.5, tags: ['walking', 'evening', 'free'] },
      { id: 'old-quarter', name: 'Old Quarter (36 Streets)', category: 'culture', summary: 'Dense grid of streets historically named after the goods sold there; best explored on foot.', hours: 2, tags: ['walking', 'shopping', 'street food'] },
      { id: 'temple-of-literature', name: 'Temple of Literature', category: 'culture', summary: "Confucian temple that housed Vietnam's first national university, with courtyards and stone stelae.", hours: 1.5, tags: ['history', 'architecture'] },
      { id: 'bun-cha', name: 'Bún chả lunch', category: 'food', summary: 'Grilled pork with rice noodles, herbs and dipping sauce — a classic Hà Nội lunch.', hours: 1, tags: ['local dish', 'lunch'] },
      { id: 'train-street', name: 'Train Street area', category: 'sight', summary: 'Narrow residential street with a railway running between houses; access is sometimes restricted for safety.', hours: 1, tags: ['photography'] },
    ],
  },
  {
    id: 'hue', name: 'Huế', aliases: ['hue', 'huế'], lat: 16.4637, lon: 107.5909,
    places: [
      { id: 'imperial-city', name: 'Imperial City', category: 'culture', summary: 'Walled former seat of the Nguyễn dynasty with palaces, gates and gardens.', hours: 3, tags: ['history', 'unesco'] },
      { id: 'thien-mu', name: 'Thiên Mụ Pagoda', category: 'culture', summary: 'Seven-storey pagoda on a hill above the Perfume River.', hours: 1, tags: ['river', 'temple'] },
      { id: 'khai-dinh', name: 'Tomb of Khải Định', category: 'sight', summary: 'Ornate hillside royal tomb mixing Vietnamese and European styles, decorated with glass and porcelain mosaics.', hours: 1.5, tags: ['history', 'architecture'] },
      { id: 'bun-bo-hue', name: 'Bún bò Huế breakfast', category: 'food', summary: 'Spicy lemongrass beef noodle soup, the signature dish of the city.', hours: 1, tags: ['local dish', 'breakfast'] },
      { id: 'perfume-river', name: 'Perfume River boat ride', category: 'nature', summary: 'Slow boat trip along the river, often combined with pagoda and tomb visits.', hours: 2, tags: ['river', 'relaxing'] },
    ],
  },
  {
    id: 'da-nang', name: 'Đà Nẵng', aliases: ['danang', 'da nang', 'đà nẵng'], lat: 16.0544, lon: 108.2022,
    places: [
      { id: 'my-khe', name: 'Mỹ Khê Beach', category: 'nature', summary: 'Long sandy city beach, good for an early swim before the heat.', hours: 2, tags: ['beach', 'morning'] },
      { id: 'marble-mountains', name: 'Marble Mountains', category: 'sight', summary: 'Limestone hills with caves, pagodas and viewpoints; involves stairs.', hours: 2.5, tags: ['caves', 'hiking'] },
      { id: 'son-tra', name: 'Sơn Trà Peninsula', category: 'nature', summary: 'Forested peninsula with coastal roads, viewpoints and the Linh Ứng pagoda.', hours: 3, tags: ['scenic drive', 'viewpoint'] },
      { id: 'dragon-bridge', name: 'Dragon Bridge', category: 'nightlife', summary: 'Bridge shaped like a dragon, lit up at night; known for fire and water shows on weekend evenings.', hours: 1, tags: ['evening', 'free'] },
      { id: 'mi-quang', name: 'Mì Quảng', category: 'food', summary: 'Turmeric noodles with a small amount of rich broth, shrimp, pork and crackers.', hours: 1, tags: ['local dish'] },
    ],
  },
  {
    id: 'hoi-an', name: 'Hội An', aliases: ['hoian', 'hoi an', 'hội an'], lat: 15.8801, lon: 108.338,
    places: [
      { id: 'ancient-town', name: 'Hội An Ancient Town', category: 'culture', summary: 'Well-preserved trading port with merchant houses, assembly halls and the Japanese Covered Bridge.', hours: 3, tags: ['unesco', 'walking', 'history'] },
      { id: 'lantern-night', name: 'Lantern evening by the Thu Bồn River', category: 'nightlife', summary: 'Riverside lanterns and night market; boats release paper lanterns on the water.', hours: 2, tags: ['evening', 'photography'] },
      { id: 'an-bang', name: 'An Bàng Beach', category: 'nature', summary: 'Relaxed beach a short ride from the old town.', hours: 2.5, tags: ['beach', 'relaxing'] },
      { id: 'cao-lau', name: 'Cao lầu', category: 'food', summary: 'Chewy noodles with pork and greens, closely tied to Hội An.', hours: 1, tags: ['local dish'] },
      { id: 'tra-que', name: 'Trà Quế herb village', category: 'nature', summary: 'Vegetable and herb gardens reachable by bicycle; cooking classes nearby.', hours: 2, tags: ['cycling', 'countryside'] },
    ],
  },
  {
    id: 'da-lat', name: 'Đà Lạt', aliases: ['dalat', 'da lat', 'đà lạt'], lat: 11.9404, lon: 108.4583,
    places: [
      { id: 'xuan-huong', name: 'Xuân Hương Lake', category: 'nature', summary: 'Lake in the centre of the cool highland city, pleasant for a walk or cycle.', hours: 1.5, tags: ['walking', 'relaxing'] },
      { id: 'night-market', name: 'Đà Lạt Night Market', category: 'nightlife', summary: 'Evening street-food and clothing market; bring a jacket, nights are cool.', hours: 2, tags: ['evening', 'street food'] },
      { id: 'langbiang', name: 'Langbiang Mountain', category: 'nature', summary: 'Mountain north of the city with hiking trails and wide views.', hours: 4, tags: ['hiking', 'viewpoint'] },
      { id: 'crazy-house', name: 'Hằng Nga "Crazy House"', category: 'sight', summary: 'Whimsical organic-style building with tunnels and bridges.', hours: 1, tags: ['architecture'] },
    ],
  },
  {
    id: 'ho-chi-minh', name: 'TP. Hồ Chí Minh', aliases: ['saigon', 'sài gòn', 'sai gon', 'ho chi minh', 'hcm', 'hồ chí minh'], lat: 10.7769, lon: 106.7009,
    places: [
      { id: 'ben-thanh', name: 'Bến Thành Market', category: 'food', summary: 'Central market with food stalls and souvenirs.', hours: 1.5, tags: ['shopping', 'street food'] },
      { id: 'war-remnants', name: 'War Remnants Museum', category: 'culture', summary: 'Museum documenting the Vietnam War; some exhibits are graphic.', hours: 2, tags: ['history', 'museum'] },
      { id: 'notre-dame', name: 'Notre-Dame Cathedral & Central Post Office', category: 'sight', summary: 'French-colonial landmarks side by side in District 1.', hours: 1, tags: ['architecture'] },
      { id: 'cu-chi', name: 'Củ Chi Tunnels (day trip)', category: 'sight', summary: 'Wartime tunnel network outside the city; usually a half-day trip.', hours: 5, tags: ['history', 'day trip'] },
      { id: 'district-4-food', name: 'District 4 seafood streets', category: 'food', summary: 'Busy evening street-food scene known for snails and grilled seafood.', hours: 2, tags: ['evening', 'street food'] },
    ],
  },
];

/** Lower-cases and removes Vietnamese diacritics so 'Hội An', 'hoi an' and 'HOI AN' compare equal. */
export const foldText = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();

/** Finds a city by id, name or alias, ignoring case and Vietnamese diacritics. */
export function findCity(query: string): City | undefined {
  const q = foldText(query).replace(/[-_]/g, ' ');
  return CITIES.find((c) => [c.id.replace(/-/g, ' '), c.name, ...c.aliases].some((n) => foldText(n) === q));
}

/** Finds the first supported city mentioned anywhere in free text. */
export function findCityInText(text: string): City | undefined {
  const q = foldText(text);
  return CITIES.find((c) => [c.name, ...c.aliases].some((n) => q.includes(foldText(n))));
}
