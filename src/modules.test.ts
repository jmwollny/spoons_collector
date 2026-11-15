import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDate, formatMiles, plural, todayDate } from './utils';
import { summariseCrawl } from './crawl';
import { unlockedTitles } from './achievements';
import { buildPubData, loadPubData } from './data';
import { loadVisitsCopy, saveVisitsCopy } from './visits';
import { makeCrawl, makePub, makeVisit, samplePubs } from './test/fixtures';

describe('utils', () => {
  it('formats dates, rejecting malformed ones', () => {
    expect(formatDate('2026-01-05')).toBe('5 Jan 2026');
    expect(formatDate('2026-12-25')).toBe('25 Dec 2026');
    expect(formatDate('yesterday')).toBeNull();
  });

  it('formats miles: one decimal under 10, whole above', () => {
    expect(formatMiles(0.04)).toBe('0.0 mi');
    expect(formatMiles(9.94)).toBe('9.9 mi');
    expect(formatMiles(12.6)).toBe('13 mi');
  });

  it('pluralises', () => {
    expect(plural(1, 'visit')).toBe('1 visit');
    expect(plural(0, 'visit')).toBe('0 visits');
    expect(plural(3, 'pub')).toBe('3 pubs');
  });

  describe('todayDate', () => {
    afterEach(() => vi.useRealTimers());

    it("is the local date, even just after midnight in summer", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 6, 4, 0, 30));
      expect(todayDate()).toBe('2026-07-04');
      vi.setSystemTime(new Date(2026, 0, 9, 23, 59));
      expect(todayDate()).toBe('2026-01-09');
    });
  });
});

describe('summariseCrawl', () => {
  it('works out the numbers the crawl panel shows', () => {
    const crawl = makeCrawl({ unlockedAtStart: ['First Pint'] });
    const summary = summariseCrawl(crawl, { 1: [makeVisit(1, '2026-11-15')] }, ['First Pint', 'Regular']);
    expect(summary).toMatchObject({
      totalMiles: 0.1,
      start: 600,
      finish: 725,
      durationMinutes: 125,
      newCount: 2,
      doneCount: 1,
      isComplete: false,
      nextPubId: 2,
      goesLate: false,
      warnings: [],
      newAchievements: ['Regular'],
    });
    expect(summary.doneIds).toEqual(new Set([1]));
  });

  it('is complete when every stop is visited, with no next stop', () => {
    const visits = { 1: [makeVisit(1, '2026-11-15')], 2: [makeVisit(2, '2026-11-16')] };
    const summary = summariseCrawl(makeCrawl(), visits, []);
    expect(summary.isComplete).toBe(true);
    expect(summary.nextPubId).toBeUndefined();
    // An older crawl didn't record what was unlocked at its start
    expect(summary.newAchievements).toEqual([]);
  });
});

describe('unlockedTitles', () => {
  it('lists the achievements unlocked', () => {
    expect(unlockedTitles(samplePubs, new Set(), {})).toEqual([]);
    expect(unlockedTitles(samplePubs, new Set([4]), {})).toEqual(['First Pint', 'Off the Beaten Track']);
  });
});

describe('pub data', () => {
  const raw = [
    { ...makePub(0, 53, -2), id: 111, jdwId: 1783, name: 'B pub', region: 'Wales' },
    { ...makePub(0, 55, -1), id: 222, jdwId: 1786, name: 'A pub', region: 'Scotland' },
    // No Wetherspoon id: left out
    { ...makePub(0, 50, -5), id: 333, jdwId: null },
  ];

  it("keys pubs on Wetherspoon's id, keeping the OSM id", () => {
    const data = buildPubData(raw);
    expect(data.locations.map((pub) => [pub.id, pub.osmId])).toEqual([
      [1783, 111],
      [1786, 222],
    ]);
    expect(data.pubsById.get(1786)?.name).toBe('A pub');
  });

  it('lists regions A to Z, and bounds the map around every pub', () => {
    const data = buildPubData(raw);
    expect(data.regions).toEqual(['Scotland', 'Wales']);
    expect(data.initialMapBounds).toEqual([
      [53, -2],
      [55, -1],
    ]);
  });

  describe('loadPubData', () => {
    beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
    afterEach(() => vi.unstubAllGlobals());

    it('fetches and builds the data', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(raw)));
      const data = await loadPubData();
      expect(data.locations).toHaveLength(2);
      expect(vi.mocked(fetch).mock.calls[0][0]).toMatch(/spoons_enriched/);
    });

    it('fails clearly when the data is missing', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('Not found', { status: 404 }));
      await expect(loadPubData()).rejects.toThrow('HTTP 404');
    });
  });
});

describe('second copy of the visits', () => {
  it('saves and reads back', async () => {
    expect(await loadVisitsCopy()).toBeNull();
    const visits = [makeVisit(1, '2026-11-15')];
    await saveVisitsCopy(visits);
    expect(await loadVisitsCopy()).toEqual(visits);
  });
});
