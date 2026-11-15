import { describe, expect, it } from 'vitest';
import {
  crawlWarnings,
  formatArrival,
  formatDuration,
  formatTime,
  isLate,
  isStopDone,
  planCrawl,
  sanitiseCrawl,
  shortestOrder,
  travelMinutes,
  type Crawl,
  type CrawlOptions,
} from './crawl';
import { distanceMiles } from './utils';
import { makePub, makeVisit } from './test/pubs';

const pathLength = (start: { lat: number; lon: number }, points: { lat: number; lon: number }[]) =>
  points.reduce(
    (sum, point, index) => {
      const from = index === 0 ? start : points[index - 1];
      return sum + distanceMiles(from.lat, from.lon, point.lat, point.lon);
    },
    0,
  );

const permutations = <T,>(items: T[]): T[][] =>
  items.length <= 1
    ? [items]
    : items.flatMap((item, index) =>
        permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
      );

// A deterministic stand-in for Math.random, so failures can be reproduced
const seededRandom = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 2 ** 32;
  return seed / 2 ** 32;
};

describe('shortestOrder', () => {
  it('finds the shortest path, checked against every possible order', () => {
    const random = seededRandom(42);
    for (let trial = 0; trial < 20; trial++) {
      const start = { lat: 53.8, lon: -1.55 };
      const points = Array.from({ length: 6 }, () => ({
        lat: 53.8 + (random() - 0.5) * 0.05,
        lon: -1.55 + (random() - 0.5) * 0.05,
      }));
      const order = shortestOrder(start, points);
      const best = Math.min(...permutations(points).map((perm) => pathLength(start, perm)));
      expect(pathLength(start, order.map((index) => points[index]))).toBeCloseTo(best, 9);
    }
  });

  it('visits each point exactly once', () => {
    const points = [0, 1, 2, 3].map((index) => ({ lat: 53 + index * 0.01, lon: -1 }));
    expect([...shortestOrder({ lat: 53, lon: -1 }, points)].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe('travelMinutes', () => {
  it('allows 30% extra for the real route and rounds up to 5 minutes', () => {
    // 1 mile × 1.3 at 3 mph = 26 minutes → 30
    expect(travelMinutes(1, 'walk')).toBe(30);
    // 10 miles × 1.3 at 25 mph = 31.2 minutes → 35
    expect(travelMinutes(10, 'drive')).toBe(35);
    expect(travelMinutes(0, 'walk')).toBe(0);
  });
});

describe('planCrawl', () => {
  // A street of pubs 110 m apart, heading north
  const street = Array.from({ length: 8 }, (_, index) =>
    makePub(index + 1, 53.8 + index * 0.001, -1.55),
  );
  const options: CrawlOptions = {
    start: { kind: 'pub', pubId: 1 },
    stopCount: 4,
    style: 'any',
    mode: 'walk',
    startTime: 10 * 60,
    stayMinutes: 60,
    date: '2026-11-15',
  };

  it('starts at the chosen pub and takes the nearest others in order', () => {
    const crawl = planCrawl(options, street, new Set());
    expect(crawl.startIsPub).toBe(true);
    expect(crawl.stops.map((stop) => stop.pubId)).toEqual([1, 2, 3, 4]);
    expect(crawl.stops[0].legMiles).toBe(0);
  });

  it('skips visited pubs for "new to me", but still starts at the chosen pub', () => {
    const crawl = planCrawl({ ...options, style: 'new' }, street, new Set([1, 2, 3]));
    expect(crawl.stops.map((stop) => stop.pubId)).toEqual([1, 4, 5, 6]);
    expect(crawl.stops[0].wasNew).toBe(false);
    expect(crawl.stops[1].wasNew).toBe(true);
  });

  it('picks the rarest pubs within reach for a rarity hunt', () => {
    const pubs = [
      makePub(1, 53.8, -1.55),
      makePub(2, 53.801, -1.55, { rarity: 'Common' }),
      makePub(3, 53.81, -1.55, { rarity: 'Epic' }),
      makePub(4, 53.82, -1.55, { rarity: 'Rare' }),
      // Legendary, but about 70 miles away: out of walking reach
      makePub(5, 54.8, -1.55, { rarity: 'Legendary' }),
    ];
    const crawl = planCrawl({ ...options, style: 'rarity', stopCount: 3 }, pubs, new Set());
    expect(crawl.stops.map((stop) => stop.pubId).sort()).toEqual([1, 3, 4]);
  });

  it('starts from the middle of a town', () => {
    const pubs = [
      makePub(1, 53.8, -1.5, { city: 'Leeds' }),
      makePub(2, 53.81, -1.5, { city: 'Leeds' }),
      makePub(3, 54.0, -1.5, { city: 'York' }),
    ];
    const crawl = planCrawl(
      { ...options, start: { kind: 'town', town: 'leeds' }, stopCount: 2 },
      pubs,
      new Set(),
    );
    expect(crawl.startIsPub).toBe(false);
    expect(crawl.startLat).toBeCloseTo(53.805, 6);
    expect(crawl.startLabel).toBe('Leeds');
  });

  it('explains when the town has no Wetherspoon', () => {
    expect(() =>
      planCrawl({ ...options, start: { kind: 'town', town: 'Atlantis' } }, street, new Set()),
    ).toThrow('There are no Wetherspoons in "Atlantis"');
  });

  it('explains when there are too few unvisited pubs', () => {
    const visited = new Set(street.map((pub) => pub.id));
    expect(() => planCrawl({ ...options, style: 'new' }, street, visited)).toThrow(
      "aren't enough pubs you haven't visited",
    );
  });

  it('gives each meal to the first stop reached in its time', () => {
    // An hour or so per stop from 10:00: breakfast, then lunch from noon,
    // then nothing until dinner from 5pm
    const crawl = planCrawl({ ...options, stopCount: 8 }, street, new Set());
    const meals = crawl.stops.map((stop) => [formatTime(stop.arrive), stop.meal]);
    expect(meals[0]).toEqual(['10:00', 'Breakfast']);
    expect(meals.filter(([, meal]) => meal === 'Breakfast')).toHaveLength(1);
    expect(meals.filter(([, meal]) => meal === 'Lunch')).toHaveLength(1);
    const lunch = crawl.stops.find((stop) => stop.meal === 'Lunch')!;
    expect(lunch.arrive).toBeGreaterThanOrEqual(12 * 60);
  });

  it('only calls the last stop a nightcap, and only late on', () => {
    const late = planCrawl({ ...options, startTime: 20 * 60, stopCount: 3 }, street, new Set());
    expect(late.stops.map((stop) => stop.meal)).toEqual(['Dinner', null, 'Nightcap']);
  });
});

describe('time formatting', () => {
  it('formats times, wrapping past midnight', () => {
    expect(formatTime(9 * 60 + 5)).toBe('09:05');
    expect(formatTime(24 * 60 + 30)).toBe('00:30');
    expect(formatArrival(23 * 60)).toBe('23:00');
    expect(formatArrival(25 * 60)).toBe('01:00 next day');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(120)).toBe('2 h');
    expect(formatDuration(150)).toBe('2 h 30 min');
  });

  it('treats 11pm to 6am as late', () => {
    expect(isLate(22 * 60 + 59)).toBe(false);
    expect(isLate(23 * 60)).toBe(true);
    expect(isLate(24 * 60 + 5 * 60)).toBe(true);
    // Noon the next day isn't late, just a very long crawl
    expect(isLate(24 * 60 + 12 * 60)).toBe(false);
  });
});

const crawlWith = (overrides: Partial<Crawl>): Crawl => ({
  id: 'crawl-1',
  date: '2026-11-15',
  style: 'any',
  mode: 'walk',
  stayMinutes: 60,
  startLabel: 'Testville',
  startLat: 53.8,
  startLon: -1.55,
  startIsPub: true,
  stops: [
    { pubId: 1, legMiles: 0, arrive: 600, meal: 'Breakfast', wasNew: true },
    { pubId: 2, legMiles: 0.5, arrive: 680, meal: null, wasNew: true },
  ],
  ...overrides,
});

describe('crawlWarnings', () => {
  it('is quiet about a sensible crawl', () => {
    expect(crawlWarnings(crawlWith({}))).toEqual([]);
  });

  it('warns about a long walk or a long stretch', () => {
    const long = crawlWith({
      stops: [
        { pubId: 1, legMiles: 0, arrive: 600, meal: null, wasNew: true },
        { pubId: 2, legMiles: 4, arrive: 800, meal: null, wasNew: true },
      ],
    });
    expect(crawlWarnings(long)[0]).toMatch(/long walk/);
    // By car, the same distances are fine
    expect(crawlWarnings({ ...long, mode: 'drive' })).toEqual([]);
  });

  it('warns about running past 2am', () => {
    const late = crawlWith({
      stops: [{ pubId: 1, legMiles: 0, arrive: 25 * 60 + 30, meal: null, wasNew: true }],
    });
    expect(crawlWarnings(late)[0]).toMatch(/past 2am/);
  });
});

describe('isStopDone', () => {
  it('counts visits on or after the day of the crawl', () => {
    const crawl = crawlWith({});
    expect(isStopDone(crawl, 1, { 1: [makeVisit(1, '2026-11-15')] })).toBe(true);
    expect(isStopDone(crawl, 1, { 1: [makeVisit(1, '2026-11-16')] })).toBe(true);
    expect(isStopDone(crawl, 1, { 1: [makeVisit(1, '2026-11-14')] })).toBe(false);
    expect(isStopDone(crawl, 2, {})).toBe(false);
  });
});

describe('sanitiseCrawl', () => {
  const pubs = [makePub(1, 53.8, -1.55), makePub(2, 53.801, -1.55)];

  it('keeps a valid crawl', () => {
    expect(sanitiseCrawl(crawlWith({}), pubs)?.stops).toHaveLength(2);
  });

  it('drops stops whose pub has gone, and the crawl if none are left', () => {
    expect(sanitiseCrawl(crawlWith({}), [pubs[0]])?.stops.map((stop) => stop.pubId)).toEqual([1]);
    expect(sanitiseCrawl(crawlWith({}), [])).toBeNull();
  });

  it('rejects things that are not crawls', () => {
    expect(sanitiseCrawl(null, pubs)).toBeNull();
    expect(sanitiseCrawl('crawl', pubs)).toBeNull();
    expect(sanitiseCrawl({ ...crawlWith({}), date: 'yesterday' }, pubs)).toBeNull();
    expect(sanitiseCrawl({ ...crawlWith({}), stops: 'lots' }, pubs)).toBeNull();
  });
});
