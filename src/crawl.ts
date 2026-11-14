import type { PubLocation, VisitEntry } from './types';
import { distanceMiles, formatMiles } from './utils';

/** Which pubs a crawl picks */
export type CrawlStyle =
  // Pubs the user hasn't visited, nearest first
  | 'new'
  // The rarest pubs within reach
  | 'rarity'
  // Any pubs, nearest first
  | 'any';

export type TravelMode = 'walk' | 'drive';

export type CrawlStart =
  | { kind: 'pub'; pubId: number }
  | { kind: 'here'; lat: number; lon: number }
  | { kind: 'town'; town: string };

export type Meal = 'Breakfast' | 'Lunch' | 'Dinner' | 'Nightcap';

export type CrawlStop = {
  // The pub's Wetherspoon id
  pubId: number;
  // Straight-line miles from the previous stop (or the start)
  legMiles: number;
  // Estimated arrival, in minutes after midnight on the crawl's day
  arrive: number;
  meal: Meal | null;
  // Whether the user hadn't been to the pub when the crawl was planned
  wasNew: boolean;
};

export type Crawl = {
  id: string;
  // Day of the crawl, YYYY-MM-DD. A visit on or after it ticks a stop off.
  date: string;
  style: CrawlStyle;
  mode: TravelMode;
  stayMinutes: number;
  startLabel: string;
  startLat: number;
  startLon: number;
  // Whether the crawl starts at its first pub, rather than a place
  startIsPub: boolean;
  stops: CrawlStop[];
  // Achievements already unlocked when the crawl started, so the summary at
  // the end can show what the crawl unlocked (missing on older crawls)
  unlockedAtStart?: string[];
};

export type CrawlOptions = {
  start: CrawlStart;
  stopCount: number;
  style: CrawlStyle;
  mode: TravelMode;
  // Minutes after midnight
  startTime: number;
  stayMinutes: number;
  // YYYY-MM-DD
  date: string;
};

export const MIN_STOPS = 2;
export const MAX_STOPS = 8;

// Average speeds, and how much longer a real route is than a straight line
const MPH: Record<TravelMode, number> = { walk: 3, drive: 25 };
const ROUTE_FACTOR = 1.3;
// How far the rarity hunt looks for pubs
const RARITY_RADIUS_MILES: Record<TravelMode, number> = { walk: 3, drive: 30 };

const RARITY_WEIGHTS: Record<string, number> = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Epic: 4,
  Legendary: 5,
};

// Typical Wetherspoon food times. Our data has no opening hours, so these
// are general, not each pub's own.
const MEAL_WINDOWS: Array<{ meal: Meal; from: number; to: number }> = [
  { meal: 'Breakfast', from: 6 * 60, to: 12 * 60 },
  { meal: 'Lunch', from: 12 * 60, to: 15 * 60 },
  { meal: 'Dinner', from: 17 * 60, to: 21 * 60 },
];
const NIGHTCAP_FROM = 21 * 60;
// Most Wetherspoons close between 11pm and 1am
export const LATE_FROM = 23 * 60;

type Point = { lat: number; lon: number };

const miles = (a: Point, b: Point) => distanceMiles(a.lat, a.lon, b.lat, b.lon);

/** Minutes to travel a straight-line distance, rounded up to 5 minutes */
export const travelMinutes = (straightMiles: number, mode: TravelMode) =>
  Math.ceil(((straightMiles * ROUTE_FACTOR) / MPH[mode]) * 60 / 5) * 5;

/**
 * The order of `points` that makes the shortest path from `start`, as
 * indexes into `points`. A crawl has at most eight stops, which is few
 * enough to try every order (with the hopeless ones cut short).
 */
export const shortestOrder = (start: Point, points: Point[]): number[] => {
  let best: number[] = points.map((_, index) => index);
  let bestLength = Infinity;
  const used = new Array<boolean>(points.length).fill(false);
  const path: number[] = [];

  const visit = (from: Point, length: number) => {
    if (length >= bestLength) {
      return;
    }
    if (path.length === points.length) {
      bestLength = length;
      best = [...path];
      return;
    }
    for (let index = 0; index < points.length; index++) {
      if (!used[index]) {
        used[index] = true;
        path.push(index);
        visit(points[index], length + miles(from, points[index]));
        path.pop();
        used[index] = false;
      }
    }
  };

  visit(start, 0);
  return best;
};

/** Where a crawl starts, as a point and a name */
const resolveStart = (start: CrawlStart, locations: PubLocation[]) => {
  if (start.kind === 'pub') {
    const pub = locations.find((location) => location.id === start.pubId);
    if (!pub) {
      throw new Error("Couldn't find that pub.");
    }
    return { lat: pub.lat, lon: pub.lon, label: `${pub.name}, ${pub.city}`, pub };
  }
  if (start.kind === 'here') {
    return { lat: start.lat, lon: start.lon, label: 'your location', pub: null };
  }
  const town = start.town.trim().toLowerCase();
  const inTown = locations.filter((location) => location.city.toLowerCase() === town);
  if (inTown.length === 0) {
    throw new Error(`There are no Wetherspoons in "${start.town}". Pick a town from the list.`);
  }
  // The middle of the town's pubs
  return {
    lat: inTown.reduce((sum, pub) => sum + pub.lat, 0) / inTown.length,
    lon: inTown.reduce((sum, pub) => sum + pub.lon, 0) / inTown.length,
    label: inTown[0].city,
    pub: null,
  };
};

/** The pubs to visit, besides a starting pub */
const choosePubs = (
  candidates: PubLocation[],
  from: Point,
  count: number,
  style: CrawlStyle,
  mode: TravelMode,
) => {
  const byDistance = candidates
    .map((pub) => ({ pub, miles: miles(from, pub) }))
    .sort((a, b) => a.miles - b.miles);

  if (style !== 'rarity') {
    return byDistance.slice(0, count).map(({ pub }) => pub);
  }

  // Rarest first within reach, nearest first within a rarity; topped up
  // with the nearest pubs if there aren't enough within reach
  const inReach = byDistance
    .filter(({ miles: distance }) => distance <= RARITY_RADIUS_MILES[mode])
    .sort(
      (a, b) =>
        (RARITY_WEIGHTS[b.pub.rarity] ?? 0) - (RARITY_WEIGHTS[a.pub.rarity] ?? 0) ||
        a.miles - b.miles,
    )
    .slice(0, count)
    .map(({ pub }) => pub);
  const topUp = byDistance
    .map(({ pub }) => pub)
    .filter((pub) => !inReach.includes(pub))
    .slice(0, count - inReach.length);
  return [...inReach, ...topUp];
};

/**
 * Plans a crawl: picks the pubs, puts them in the shortest order, and
 * estimates when the user reaches each one and which meal it's good for.
 * Throws an Error with a message fit to show the user.
 */
export const planCrawl = (
  options: CrawlOptions,
  locations: PubLocation[],
  visitedIds: Set<number>,
): Crawl => {
  const start = resolveStart(options.start, locations);
  const wanted = options.stopCount - (start.pub ? 1 : 0);

  const candidates = locations.filter(
    (pub) => pub.id !== start.pub?.id && (options.style !== 'new' || !visitedIds.has(pub.id)),
  );
  const chosen = choosePubs(candidates, start, wanted, options.style, options.mode);
  if (chosen.length < wanted) {
    throw new Error("There aren't enough pubs you haven't visited for a crawl that long.");
  }

  const order = shortestOrder(start, chosen).map((index) => chosen[index]);
  const route = start.pub ? [start.pub, ...order] : order;

  const usedMeals = new Set<Meal>();
  const stops: CrawlStop[] = [];
  let previous: Point = start;
  let clock = options.startTime;
  route.forEach((pub, index) => {
    const legMiles = miles(previous, pub);
    clock += travelMinutes(legMiles, options.mode);

    // Each meal goes to the first stop reached in its time window
    const window = MEAL_WINDOWS.find(
      ({ meal, from, to }) => !usedMeals.has(meal) && clock >= from && clock < to,
    );
    let meal: Meal | null = window?.meal ?? null;
    if (!meal && index === route.length - 1 && clock >= NIGHTCAP_FROM) {
      meal = 'Nightcap';
    }
    if (meal) {
      usedMeals.add(meal);
    }

    stops.push({ pubId: pub.id, legMiles, arrive: clock, meal, wasNew: !visitedIds.has(pub.id) });
    clock += options.stayMinutes;
    previous = pub;
  });

  return {
    id: `crawl-${Date.now()}`,
    date: options.date,
    style: options.style,
    mode: options.mode,
    stayMinutes: options.stayMinutes,
    startLabel: start.label,
    startLat: start.lat,
    startLon: start.lon,
    startIsPub: Boolean(start.pub),
    stops,
  };
};

const DAY = 24 * 60;
// Most Wetherspoons have closed by 2am
const CLOSED_FROM = DAY + 2 * 60;
// A walking crawl longer than this, or with a longer leg, is a slog
const LONG_WALK_MILES = 8;
const LONG_WALK_LEG_MILES = 3;

/** Whether a stop is reached late at night, when the pub may be closing */
export const isLate = (arrive: number) => arrive >= LATE_FROM && arrive < DAY + 6 * 60;

/** e.g. 630 → "10:30"; 1500 → "01:00 next day" */
export const formatArrival = (minutes: number) =>
  minutes >= DAY ? `${formatTime(minutes)} next day` : formatTime(minutes);

/** Reasons a crawl may not work as planned, to show the user */
export const crawlWarnings = (crawl: Crawl): string[] => {
  const warnings: string[] = [];
  const total = crawl.stops.reduce((sum, stop) => sum + stop.legMiles, 0);
  const longestLeg = Math.max(...crawl.stops.map((stop) => stop.legMiles));
  if (crawl.mode === 'walk' && (total > LONG_WALK_MILES || longestLeg > LONG_WALK_LEG_MILES)) {
    warnings.push(
      `That's a long walk: ${formatMiles(total)} in all, the longest stretch ${formatMiles(longestLeg)}. ` +
        'Fewer pubs, or car, bus or train, may suit better.',
    );
  }
  const last = crawl.stops[crawl.stops.length - 1];
  if (last.arrive + crawl.stayMinutes > CLOSED_FROM) {
    warnings.push(
      'This crawl runs past 2am, when most Wetherspoons have closed. Try fewer pubs, shorter stays or an earlier start.',
    );
  }
  return warnings;
};

/** e.g. 630 → "10:30". Times past midnight wrap round. */
export const formatTime = (minutes: number) => {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const hours = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const mins = String(wrapped % 60).padStart(2, '0');
  return `${hours}:${mins}`;
};

/** e.g. 150 → "2 h 30 min" */
export const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  return mins === 0 ? `${hours} h` : `${hours} h ${mins} min`;
};

const STORAGE_KEY = 'spoons-collector-crawl-v1';

/** The saved crawl, without any stops whose pub is no longer in the data */
export const loadCrawl = (locations: PubLocation[]): Crawl | null => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const crawl = JSON.parse(saved) as Crawl;
    const ids = new Set(locations.map((location) => location.id));
    const stops = crawl.stops.filter((stop) => ids.has(stop.pubId));
    return stops.length > 0 ? { ...crawl, stops } : null;
  } catch {
    return null;
  }
};

export const saveCrawl = (crawl: Crawl | null) => {
  if (crawl) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(crawl));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
};

/** Whether the user has visited a pub on or after the crawl's day */
export const isStopDone = (
  crawl: Crawl,
  pubId: number,
  indexedVisits: Record<number, VisitEntry[]>,
) => Boolean(indexedVisits[pubId]?.some((visit) => visit.date >= crawl.date));
