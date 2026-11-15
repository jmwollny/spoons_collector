import type { PubLocation } from './types';
import type { Crawl, Meal } from './crawl';

/** Points for a pub ticked off on a crawl, by rarity */
export const RARITY_POINTS: Record<string, number> = {
  Common: 10,
  Uncommon: 20,
  Rare: 40,
  Epic: 70,
  Legendary: 100,
};
// For eating at a meal stop
const MEAL_BONUS = 10;

/**
 * Points for the stops ticked off: by rarity, doubled for a pub new to the
 * user, plus a bonus for a meal stop, and half as much again on a treasure
 * hunt for a stop found without revealing it.
 */
export const stopPoints = (crawl: Crawl, stopIndex: number, pubsById: Map<number, PubLocation>) => {
  const stop = crawl.stops[stopIndex];
  const pub = pubsById.get(stop.pubId);
  let points = (RARITY_POINTS[pub?.rarity ?? ''] ?? 0) * (stop.wasNew ? 2 : 1);
  if (stop.meal && stop.meal !== 'Nightcap') points += MEAL_BONUS;
  if (crawl.treasureHunt && !crawl.revealed?.includes(stop.pubId)) points = Math.round(points * 1.5);
  return points;
};

export const crawlScore = (crawl: Crawl, doneIds: Set<number>, pubsById: Map<number, PubLocation>) =>
  crawl.stops.reduce(
    (total, stop, index) => total + (doneIds.has(stop.pubId) ? stopPoints(crawl, index, pubsById) : 0),
    0,
  );

/** A finished crawl, kept for achievements */
export type CompletedCrawl = {
  id: string;
  date: string;
  pubCount: number;
  totalMiles: number;
  mode: Crawl['mode'];
  score: number;
  // The meals eaten at its stops
  meals: Meal[];
  treasureHunt: boolean;
  revealedCount: number;
};

export const completedCrawl = (
  crawl: Crawl,
  doneIds: Set<number>,
  pubsById: Map<number, PubLocation>,
): CompletedCrawl => ({
  id: crawl.id,
  date: crawl.date,
  pubCount: crawl.stops.length,
  totalMiles: crawl.stops.reduce((sum, stop) => sum + stop.legMiles, 0),
  mode: crawl.mode,
  score: crawlScore(crawl, doneIds, pubsById),
  meals: crawl.stops.flatMap((stop) => (stop.meal ? [stop.meal] : [])),
  treasureHunt: Boolean(crawl.treasureHunt),
  revealedCount: crawl.revealed?.length ?? 0,
});

/** Achievements for crawls, alongside those for visits */
export const crawlAchievements = (crawls: CompletedCrawl[]) => {
  const best = (measure: (crawl: CompletedCrawl) => number) => Math.max(0, ...crawls.map(measure));
  return [
    { title: 'Crawler', detail: 'Finish a Spoons crawl.', progress: crawls.length, target: 1 },
    {
      title: 'Full English',
      detail: 'Breakfast, lunch and dinner in three different Spoons on one crawl.',
      progress: best((crawl) => ['Breakfast', 'Lunch', 'Dinner'].filter((meal) => crawl.meals.includes(meal as Meal)).length),
      target: 3,
    },
    { title: 'Marathon', detail: 'Finish a crawl of five or more pubs.', progress: best((crawl) => crawl.pubCount), target: 5 },
    {
      title: 'Treasure Hunter',
      detail: 'Finish a treasure hunt without revealing a stop.',
      progress: crawls.some((crawl) => crawl.treasureHunt && crawl.revealedCount === 0) ? 1 : 0,
      target: 1,
    },
    { title: 'High Scorer', detail: 'Score 500 points on one crawl.', progress: best((crawl) => crawl.score), target: 500 },
  ];
};

// ---- History of finished crawls ----

const HISTORY_KEY = 'spoons-collector-crawl-history-v1';

const isCompletedCrawl = (value: unknown): value is CompletedCrawl => {
  const crawl = value as Partial<CompletedCrawl> | null;
  return (
    typeof crawl === 'object' &&
    crawl !== null &&
    typeof crawl.id === 'string' &&
    typeof crawl.date === 'string' &&
    typeof crawl.pubCount === 'number' &&
    typeof crawl.score === 'number' &&
    Array.isArray(crawl.meals)
  );
};

/** Keeps only the finished crawls that are readable */
export const sanitiseCrawlHistory = (value: unknown): CompletedCrawl[] =>
  Array.isArray(value) ? value.filter(isCompletedCrawl) : [];

export const loadCrawlHistory = (): CompletedCrawl[] => {
  try {
    return sanitiseCrawlHistory(JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? '[]'));
  } catch {
    return [];
  }
};

export const saveCrawlHistory = (crawls: CompletedCrawl[]) =>
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(crawls));

/** Adds crawls not already in the history (matched by id), oldest first */
export const mergeCrawlHistory = (current: CompletedCrawl[], more: CompletedCrawl[]) => {
  const known = new Set(current.map((crawl) => crawl.id));
  return [...current, ...more.filter((crawl) => !known.has(crawl.id))].sort((a, b) => a.date.localeCompare(b.date));
};
