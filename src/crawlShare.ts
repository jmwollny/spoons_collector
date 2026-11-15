import type { PubLocation } from './types';
import { crawlStartTime, formatTime, sanitiseCrawl, type Crawl, type Meal } from './crawl';
import { formatDate, plural } from './utils';

// Identifies a crawl code, and its format version
const PREFIX = 'SC1.';
// Opens the Android app on the crawl (see AndroidManifest.xml)
export const CRAWL_LINK_BASE = 'spoonscollector://crawl/';

const MEALS: Array<Meal | null> = [null, 'Breakfast', 'Lunch', 'Dinner', 'Nightcap'];

type Shared = {
  d: string; // date
  m: Crawl['mode'];
  s: number; // stay minutes
  t: number; // start time
  l: string; // start label
  a: [number, number]; // start lat, lon
  p: 0 | 1; // starts at its first pub
  h?: 1; // treasure hunt
  // Each stop: pub id, leg in hundredths of a mile, arrival, meal
  st: Array<[number, number, number, number]>;
};

const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromBase64Url = (code: string) => {
  const base64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/** A crawl as a code a friend can join it with */
export const encodeCrawl = (crawl: Crawl) => {
  const shared: Shared = {
    d: crawl.date,
    m: crawl.mode,
    s: crawl.stayMinutes,
    t: crawlStartTime(crawl),
    l: crawl.startLabel,
    a: [Number(crawl.startLat.toFixed(5)), Number(crawl.startLon.toFixed(5))],
    p: crawl.startIsPub ? 1 : 0,
    ...(crawl.treasureHunt ? { h: 1 as const } : {}),
    st: crawl.stops.map((stop) => [stop.pubId, Math.round(stop.legMiles * 100), stop.arrive, MEALS.indexOf(stop.meal)]),
  };
  return PREFIX + toBase64Url(JSON.stringify(shared));
};

/** Finds a crawl code in pasted text or a link, e.g. a whole message */
export const findCrawlCode = (text: string) => text.match(/SC1\.[A-Za-z0-9_-]+/)?.[0] ?? null;

/**
 * The crawl a code describes, ready to start. Which pubs are new depends
 * on the joiner's own visits. Throws an Error fit to show if it can't.
 */
export const decodeCrawl = (text: string, locations: PubLocation[], visitedIds: Set<number>): Crawl => {
  const code = findCrawlCode(text);
  if (!code) {
    throw new Error("That isn't a crawl code. It starts with SC1.");
  }
  let shared: Shared;
  try {
    shared = JSON.parse(fromBase64Url(code.slice(PREFIX.length)));
  } catch {
    throw new Error('That crawl code is damaged. Try copying it again.');
  }
  const crawl = sanitiseCrawl(
    {
      id: `crawl-${Date.now()}`,
      date: shared.d,
      style: 'any',
      mode: shared.m === 'drive' ? 'drive' : 'walk',
      stayMinutes: shared.s,
      startTime: shared.t,
      startLabel: shared.l,
      startLat: shared.a?.[0],
      startLon: shared.a?.[1],
      startIsPub: shared.p === 1,
      treasureHunt: shared.h === 1 || undefined,
      stops: (shared.st ?? []).map(([pubId, hundredths, arrive, meal]) => ({
        pubId,
        legMiles: hundredths / 100,
        arrive,
        meal: MEALS[meal] ?? null,
        wasNew: !visitedIds.has(pubId),
      })),
    },
    locations,
  );
  if (!crawl) {
    throw new Error('That crawl code is damaged, or its pubs have closed.');
  }
  return crawl;
};

/** The message sent to friends: what the crawl is and how to join it */
export const crawlShareText = (crawl: Crawl) => {
  const code = encodeCrawl(crawl);
  return [
    `🍺 Join my Spoons crawl on ${formatDate(crawl.date)}: ${plural(crawl.stops.length, 'pub')} from ${crawl.startLabel}, setting off at ${formatTime(crawlStartTime(crawl))}.${crawl.treasureHunt ? ' It’s a treasure hunt!' : ''}`,
    `Open it in Spoons Collector: ${CRAWL_LINK_BASE}${code}`,
    `Or in the app, tap Plan a crawl → Join a friend's crawl, and paste:`,
    code,
  ].join('\n');
};
