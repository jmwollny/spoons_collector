import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyStreetRoute, fetchStreetRoute } from './streetRoute';
import { hiddenStopIds, makeClue } from './treasure';
import {
  completedCrawl,
  crawlAchievements,
  crawlScore,
  loadCrawlHistory,
  mergeCrawlHistory,
  sanitiseCrawlHistory,
  saveCrawlHistory,
  stopPoints,
  type CompletedCrawl,
} from './crawlScore';
import { crawlShareText, decodeCrawl, encodeCrawl, findCrawlCode } from './crawlShare';
import { crawlStartTime, scheduleStops } from './crawl';
import { glasgow, leeds1, makeCrawl, makePub, samplePubs, samplePubsById } from './test/fixtures';

describe('scheduleStops', () => {
  it('times each stop and gives each meal to the first stop in its window', () => {
    const stops = scheduleStops(
      [
        { pubId: 1, legMiles: 0, legMinutes: 0, wasNew: true },
        { pubId: 2, legMiles: 1, legMinutes: 30, wasNew: false },
        { pubId: 3, legMiles: 1, legMinutes: 30, wasNew: true },
      ],
      11 * 60,
      60,
    );
    expect(stops.map((stop) => [stop.arrive, stop.meal])).toEqual([
      [660, 'Breakfast'],
      [750, 'Lunch'],
      [840, null],
    ]);
  });
});

describe('crawlStartTime', () => {
  it('uses the saved start time, or works it out for older crawls', () => {
    expect(crawlStartTime(makeCrawl({ startTime: 570 }))).toBe(570);
    // First stop reached at 10:00 after a 0-mile leg
    expect(crawlStartTime(makeCrawl())).toBe(600);
  });
});

describe('street routes', () => {
  const response = {
    code: 'Ok',
    routes: [
      {
        geometry: { coordinates: [[-1.5478, 53.8018], [-1.547, 53.802], [-1.5459, 53.8019]] },
        legs: [{ distance: 1609.344 * 0.4, duration: 9 * 60 }],
      },
    ],
  };

  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('asks for the route through the pubs, on foot or by car', async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify(response)));
    const route = await fetchStreetRoute([leeds1, samplePubsById.get(2)!], 'walk');
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      'https://routing.openstreetmap.de/routed-foot/route/v1/foot/-1.547800,53.801800;-1.545900,53.801900?overview=full&geometries=geojson&steps=false',
    );
    expect(route.path).toEqual([[53.8018, -1.5478], [53.802, -1.547], [53.8019, -1.5459]]);
    expect(route.legs[0].miles).toBeCloseTo(0.4, 5);
    // Rounded up to 5 minutes
    expect(route.legs[0].minutes).toBe(10);

    await fetchStreetRoute([leeds1, glasgow], 'drive');
    expect(vi.mocked(fetch).mock.calls[1][0]).toMatch(/^https:\/\/routing\.openstreetmap\.de\/routed-car\/route\/v1\/driving\//);
  });

  it('fails clearly', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('busy', { status: 429 }));
    await expect(fetchStreetRoute([leeds1, glasgow], 'walk')).rejects.toThrow('HTTP 429');
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ code: 'NoRoute' })));
    await expect(fetchStreetRoute([leeds1, glasgow], 'walk')).rejects.toThrow('NoRoute');
  });

  it('retimes the crawl from the street distances, keeping the first leg', () => {
    const crawl = makeCrawl({ startTime: 600 });
    const updated = applyStreetRoute(crawl, { path: [[53.8, -1.5]], legs: [{ miles: 0.4, minutes: 10 }] });
    expect(updated.streetPath).toEqual([[53.8, -1.5]]);
    expect(updated.stops[0]).toMatchObject({ legMiles: 0, arrive: 600 });
    // 10:00 + 60 minutes there + 10 minutes' walk
    expect(updated.stops[1]).toMatchObject({ legMiles: 0.4, arrive: 670 });
  });
});

describe('treasure hunt clues', () => {
  const pub = makePub(1, 0, 0, {
    name: "The Cuthbert Brodrick",
    city: 'Leeds',
    region: 'Yorkshire and The Humber',
    history:
      "Cuthbert Brodrick designed Leeds Town Hall, which opened in 1858. Brodrick's other buildings include the Corn Exchange. He later moved to France. A fourth sentence that should not appear.",
  });

  it('blanks out the name and town, keeping the first sentences', () => {
    const clue = makeClue(pub);
    expect(clue).toBe('▇▇▇ ▇▇▇ designed ▇▇▇ Town Hall, which opened in 1858. ▇▇▇ other buildings include the Corn Exchange.');
    expect(clue).not.toMatch(/Cuthbert|Brodrick|Leeds/);
  });

  it('keeps common words like "the" and "arms"', () => {
    const arms = makePub(2, 0, 0, {
      name: 'The Kings Arms',
      city: 'York',
      history: 'The arms of the Kings of England hung here when the inn was built in the town of York.',
    });
    expect(makeClue(arms)).toBe('The arms of the ▇▇▇ of England hung here when the inn was built in the town of ▇▇▇.');
  });

  it('shortens a long sentence', () => {
    const long = makePub(3, 0, 0, { history: `It ${'stood beside the river '.repeat(20)}.` });
    expect(makeClue(long).length).toBeLessThanOrEqual(240);
    expect(makeClue(long)).toMatch(/…$/);
  });

  it('falls back to rarity and region without much history', () => {
    expect(makeClue(makePub(4, 0, 0, { history: 'Short.', rarity: 'Epic', region: 'Wales' }))).toBe(
      'A epic Wetherspoon in Wales.',
    );
  });

  it('hides stops not yet found or revealed, only on a treasure hunt', () => {
    expect(hiddenStopIds(makeCrawl(), new Set())).toEqual(new Set());
    const hunt = makeCrawl({ treasureHunt: true, startIsPub: false });
    expect(hiddenStopIds(hunt, new Set())).toEqual(new Set([1, 2]));
    expect(hiddenStopIds({ ...hunt, revealed: [2] }, new Set())).toEqual(new Set([1]));
    expect(hiddenStopIds(hunt, new Set([1, 2]))).toEqual(new Set());
  });

  it('never hides the pub the crawl starts at', () => {
    expect(hiddenStopIds(makeCrawl({ treasureHunt: true }), new Set())).toEqual(new Set([2]));
  });
});

describe('crawl scores', () => {
  // Leeds 1 is Common, Leeds 2 Uncommon; both new; stop 1 is breakfast
  it('scores by rarity, doubled for new pubs, with a meal bonus', () => {
    const crawl = makeCrawl();
    expect(stopPoints(crawl, 0, samplePubsById)).toBe(10 * 2 + 10);
    expect(stopPoints(crawl, 1, samplePubsById)).toBe(20 * 2);
    expect(crawlScore(crawl, new Set([1]), samplePubsById)).toBe(30);
    expect(crawlScore(crawl, new Set([1, 2]), samplePubsById)).toBe(70);
  });

  it('gives half as much again on a treasure hunt, unless revealed', () => {
    const hunt = makeCrawl({ treasureHunt: true, revealed: [2] });
    expect(stopPoints(hunt, 0, samplePubsById)).toBe(45);
    expect(stopPoints(hunt, 1, samplePubsById)).toBe(40);
  });

  it('gives nothing for a nightcap or an unknown pub', () => {
    const crawl = makeCrawl();
    crawl.stops = [{ ...crawl.stops[1], meal: 'Nightcap', wasNew: false }, { ...crawl.stops[0], pubId: 999 }];
    expect(stopPoints(crawl, 0, samplePubsById)).toBe(20);
    expect(stopPoints(crawl, 1, samplePubsById)).toBe(10);
  });

  it('records a finished crawl', () => {
    expect(completedCrawl(makeCrawl({ treasureHunt: true, revealed: [2] }), new Set([1, 2]), samplePubsById)).toEqual({
      id: 'crawl-1',
      date: '2026-11-15',
      pubCount: 2,
      totalMiles: 0.1,
      mode: 'walk',
      score: 85,
      meals: ['Breakfast'],
      treasureHunt: true,
      revealedCount: 1,
    });
  });
});

const record = (overrides: Partial<CompletedCrawl> = {}): CompletedCrawl => ({
  id: 'c1',
  date: '2026-11-01',
  pubCount: 3,
  totalMiles: 1,
  mode: 'walk',
  score: 100,
  meals: ['Breakfast'],
  treasureHunt: false,
  revealedCount: 0,
  ...overrides,
});

describe('crawl achievements', () => {
  const progress = (crawls: CompletedCrawl[]) =>
    Object.fromEntries(crawlAchievements(crawls).map((achievement) => [achievement.title, achievement.progress]));

  it('start at nothing', () => {
    expect(progress([])).toEqual({ Crawler: 0, 'Full English': 0, Marathon: 0, 'Treasure Hunter': 0, 'High Scorer': 0 });
  });

  it('count the best crawl so far', () => {
    expect(
      progress([
        record({ meals: ['Breakfast', 'Lunch', 'Dinner', 'Nightcap'], pubCount: 6, score: 520 }),
        record({ id: 'c2', treasureHunt: true, revealedCount: 1 }),
      ]),
    ).toEqual({ Crawler: 2, 'Full English': 3, Marathon: 6, 'Treasure Hunter': 0, 'High Scorer': 520 });
    expect(progress([record({ treasureHunt: true })])['Treasure Hunter']).toBe(1);
  });
});

describe('crawl history', () => {
  it('saves, loads and keeps only readable crawls', () => {
    expect(loadCrawlHistory()).toEqual([]);
    saveCrawlHistory([record()]);
    expect(loadCrawlHistory()).toEqual([record()]);
    expect(sanitiseCrawlHistory([record(), { id: 3 }, null])).toEqual([record()]);
    expect(sanitiseCrawlHistory('nope')).toEqual([]);
    window.localStorage.setItem('spoons-collector-crawl-history-v1', '{broken');
    expect(loadCrawlHistory()).toEqual([]);
  });

  it('merges by id, oldest first', () => {
    const later = record({ id: 'c2', date: '2026-11-10' });
    const earlier = record({ id: 'c0', date: '2026-10-01' });
    expect(mergeCrawlHistory([record(), later], [later, earlier]).map((crawl) => crawl.id)).toEqual(['c0', 'c1', 'c2']);
  });
});

describe('sharing crawls', () => {
  const crawl = makeCrawl({ startTime: 600, treasureHunt: true, startLabel: 'Leeds — centre' });

  it('round-trips a crawl through a code', () => {
    const code = encodeCrawl(crawl);
    expect(code).toMatch(/^SC1\.[A-Za-z0-9_-]+$/);
    const joined = decodeCrawl(code, samplePubs, new Set([1]));
    expect(joined).toMatchObject({
      date: '2026-11-15',
      mode: 'walk',
      stayMinutes: 60,
      startTime: 600,
      startLabel: 'Leeds — centre',
      startIsPub: true,
      treasureHunt: true,
    });
    expect(joined.id).not.toBe('crawl-1');
    expect(joined.stops).toEqual([
      // Whether a pub is new depends on the joiner's own visits
      { pubId: 1, legMiles: 0, arrive: 600, meal: 'Breakfast', wasNew: false },
      { pubId: 2, legMiles: 0.1, arrive: 665, meal: null, wasNew: true },
    ]);
  });

  it('finds the code inside a whole message or link', () => {
    const code = encodeCrawl(crawl);
    expect(findCrawlCode(`Join me! spoonscollector://crawl/${code} see you there`)).toBe(code);
    expect(decodeCrawl(crawlShareText(crawl), samplePubs, new Set()).stops).toHaveLength(2);
  });

  it('explains codes it cannot use', () => {
    expect(() => decodeCrawl('hello', samplePubs, new Set())).toThrow("isn't a crawl code");
    expect(() => decodeCrawl('SC1.notvalid', samplePubs, new Set())).toThrow('damaged');
    const closed = encodeCrawl(makeCrawl({ stops: [{ pubId: 999, legMiles: 0, arrive: 600, meal: null, wasNew: true }] }));
    expect(() => decodeCrawl(closed, samplePubs, new Set())).toThrow('pubs have closed');
  });

  it('writes a message saying what the crawl is and how to join', () => {
    const text = crawlShareText(crawl);
    expect(text).toContain('🍺 Join my Spoons crawl on 15 Nov 2026: 2 pubs from Leeds — centre, setting off at 10:00. It’s a treasure hunt!');
    expect(text).toContain(`spoonscollector://crawl/${encodeCrawl(crawl)}`);
    // A treasure hunt's message doesn't give the pubs away
    expect(text).not.toContain('Cuthbert');
  });
});
