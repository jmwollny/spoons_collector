import type { PubLocation, VisitEntry } from './types';
import { distanceMiles } from './utils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;

const RARITY_RANK: Record<string, number> = { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5 };

/** Each pub's first ever visit date, YYYY-MM-DD */
const firstVisits = (visits: VisitEntry[]) => {
  const first = new Map<number, string>();
  for (const visit of visits) {
    const seen = first.get(visit.locationId);
    if (!seen || visit.date < seen) first.set(visit.locationId, visit.date);
  }
  return first;
};

export type MonthCount = {
  // YYYY-MM
  key: string;
  // e.g. "Nov"
  label: string;
  year: number;
  visits: number;
  // Pubs visited for the first time that month
  newPubs: number;
};

/** Visits in each of the last `months` months, oldest first, ending this month */
export const monthlyVisits = (visits: VisitEntry[], today: string, months = 12): MonthCount[] => {
  const [year, month] = today.split('-').map(Number);
  const first = firstVisits(visits);
  return Array.from({ length: months }, (_, index) => {
    const offset = months - 1 - index;
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    const key = date.toISOString().slice(0, 7);
    return {
      key,
      label: MONTHS[date.getUTCMonth()],
      year: date.getUTCFullYear(),
      visits: visits.filter((visit) => visit.date.startsWith(key)).length,
      newPubs: [...first.values()].filter((date) => date.startsWith(key)).length,
    };
  });
};

/** The year the user visited the most different pubs (the later, on a tie) */
export const bestYear = (visits: VisitEntry[]) => {
  const pubsByYear = new Map<number, Set<number>>();
  for (const visit of visits) {
    const year = Number(visit.date.slice(0, 4));
    if (!pubsByYear.has(year)) pubsByYear.set(year, new Set());
    pubsByYear.get(year)!.add(visit.locationId);
  }
  let best: { year: number; pubs: number } | null = null;
  for (const [year, pubs] of pubsByYear) {
    if (!best || pubs.size > best.pubs || (pubs.size === best.pubs && year > best.year)) {
      best = { year, pubs: pubs.size };
    }
  }
  return best;
};

// Weeks run Monday to Sunday. 5 Jan 1970 was a Monday.
const MONDAY_EPOCH = Date.UTC(1970, 0, 5);
const weekNumber = (date: string) => Math.floor((Date.parse(`${date}T00:00:00Z`) - MONDAY_EPOCH) / (7 * DAY_MS));

/**
 * Weeks in a row with at least one visit. The current streak still counts
 * if the latest visit was last week: it isn't broken until a whole week
 * passes without one.
 */
export const weeklyStreaks = (visits: VisitEntry[], today: string) => {
  const weeks = [...new Set(visits.map((visit) => weekNumber(visit.date)))].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  weeks.forEach((week, index) => {
    run = index > 0 && week === weeks[index - 1] + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  const thisWeek = weekNumber(today);
  const last = weeks[weeks.length - 1];
  const current = last !== undefined && thisWeek - last <= 1 ? run : 0;
  return { current, longest };
};

/** The pub visited most (the most recently visited, on a tie) */
export const favouritePub = (visits: VisitEntry[], pubsById: Map<number, PubLocation>) => {
  const counts = new Map<number, { visits: number; latest: string }>();
  for (const visit of visits) {
    const entry = counts.get(visit.locationId) ?? { visits: 0, latest: '' };
    counts.set(visit.locationId, {
      visits: entry.visits + 1,
      latest: visit.date > entry.latest ? visit.date : entry.latest,
    });
  }
  let best: { pub: PubLocation; visits: number; latest: string } | null = null;
  for (const [pubId, entry] of counts) {
    const pub = pubsById.get(pubId);
    if (!pub) continue;
    if (!best || entry.visits > best.visits || (entry.visits === best.visits && entry.latest > best.latest)) {
      best = { pub, ...entry };
    }
  }
  return best && { pub: best.pub, visits: best.visits };
};

/** Of the pubs visited, the rarest: furthest from other Wetherspoons */
export const mostRemotePub = (pubIds: Iterable<number>, pubsById: Map<number, PubLocation>) => {
  let best: PubLocation | null = null;
  for (const pubId of pubIds) {
    const pub = pubsById.get(pubId);
    if (!pub) continue;
    if (
      !best ||
      (RARITY_RANK[pub.rarity] ?? 0) > (RARITY_RANK[best.rarity] ?? 0) ||
      (pub.rarity === best.rarity && pub.secondNeighborMiles > best.secondNeighborMiles)
    ) {
      best = pub;
    }
  }
  return best;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * The pub visited furthest from the user's usual patch: the middle of the
 * pubs they've visited (the median, so one far-off trip doesn't move it)
 */
export const furthestFlung = (visits: VisitEntry[], pubsById: Map<number, PubLocation>) => {
  const pubs = [...new Set(visits.map((visit) => visit.locationId))]
    .map((pubId) => pubsById.get(pubId))
    .filter((pub): pub is PubLocation => Boolean(pub));
  if (pubs.length < 2) return null;
  const patch = { lat: median(pubs.map((pub) => pub.lat)), lon: median(pubs.map((pub) => pub.lon)) };
  let best: { pub: PubLocation; miles: number } | null = null;
  for (const pub of pubs) {
    const miles = distanceMiles(patch.lat, patch.lon, pub.lat, pub.lon);
    if (!best || miles > best.miles) best = { pub, miles };
  }
  return best;
};

/** Average stars (1 to 3) over the visits that were rated, or null */
export const averageStars = (visits: VisitEntry[]) => {
  const rated = visits.filter((visit) => visit.rating >= 0);
  if (rated.length === 0) return null;
  return rated.reduce((sum, visit) => sum + visit.rating + 1, 0) / rated.length;
};

/** The drink named most often, ignoring case, or null */
export const favouriteDrink = (visits: VisitEntry[]) => {
  const counts = new Map<string, { name: string; count: number }>();
  for (const visit of visits) {
    const name = visit.drink?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const entry = counts.get(key) ?? { name, count: 0 };
    counts.set(key, { name: entry.name, count: entry.count + 1 });
  }
  let best: { name: string; count: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  return best;
};

/** Years with at least one visit, newest first */
export const yearsWithVisits = (visits: VisitEntry[]) =>
  [...new Set(visits.map((visit) => Number(visit.date.slice(0, 4))))].sort((a, b) => b - a);

/** A year's visits summed up, for the Year in Spoons card */
export const yearInSpoons = (year: number, visits: VisitEntry[], pubsById: Map<number, PubLocation>) => {
  const inYear = visits.filter((visit) => visit.date.startsWith(`${year}-`));
  const pubIds = new Set(inYear.map((visit) => visit.locationId));
  const first = firstVisits(visits);
  const byMonth = MONTHS.map((label, index) => ({
    label,
    visits: inYear.filter((visit) => Number(visit.date.slice(5, 7)) === index + 1).length,
  }));
  const bestMonth = byMonth.reduce<{ label: string; visits: number } | null>(
    (best, month) => (month.visits > 0 && (!best || month.visits > best.visits) ? month : best),
    null,
  );
  const regions = new Set(
    [...pubIds].map((pubId) => pubsById.get(pubId)?.region).filter((region): region is string => Boolean(region)),
  );
  return {
    year,
    visits: inYear.length,
    pubs: pubIds.size,
    newPubs: [...first.values()].filter((date) => date.startsWith(`${year}-`)).length,
    regions: regions.size,
    favourite: favouritePub(inYear, pubsById),
    bestMonth,
    rarest: mostRemotePub(pubIds, pubsById),
    averageStars: averageStars(inYear),
    favouriteDrink: favouriteDrink(inYear),
  };
};

export type YearSummary = ReturnType<typeof yearInSpoons>;
