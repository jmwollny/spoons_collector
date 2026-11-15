import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCrawlSession } from './useCrawlSession';
import { makeCrawl, makeVisit, samplePubs, samplePubsById } from '../test/fixtures';
import type { VisitEntry } from '../types';
import { fetchStreetRoute } from '../streetRoute';

vi.mock('../streetRoute', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../streetRoute')>()),
  fetchStreetRoute: vi.fn(),
}));

const STORAGE_KEY = 'spoons-collector-crawl-v1';
const HISTORY_KEY = 'spoons-collector-crawl-history-v1';
const bothVisited = { 1: [makeVisit(1, '2026-11-15')], 2: [makeVisit(2, '2026-11-15')] };

const renderSession = (indexedVisits: Record<number, VisitEntry[]> = {}) => {
  const onEnterCrawl = vi.fn();
  const hook = renderHook(
    ({ visits }) =>
      useCrawlSession({ locations: samplePubs, pubsById: samplePubsById, indexedVisits: visits, onEnterCrawl }),
    { initialProps: { visits: indexedVisits } },
  );
  return { ...hook, onEnterCrawl };
};

beforeEach(() => {
  vi.mocked(fetchStreetRoute).mockReset();
});

describe('useCrawlSession', () => {
  it('starts with no crawl', () => {
    const { result } = renderSession();
    expect(result.current.crawl).toBeNull();
    expect(result.current.isCrawlMode).toBe(false);
    expect(result.current.route).toBeNull();
    expect(result.current.routeFitKey).toBe(0);
    expect(result.current.streetRouteStatus).toBe('none');
    expect(result.current.history).toEqual([]);
  });

  it('opens and closes the planner', () => {
    const { result } = renderSession();
    act(() => result.current.openPlanner());
    expect(result.current.isPlannerOpen).toBe(true);
    act(() => result.current.closePlanner());
    expect(result.current.isPlannerOpen).toBe(false);
  });

  it('starts a crawl: crawl mode, the route shown, achievements recorded', () => {
    const { result, onEnterCrawl } = renderSession();
    act(() => result.current.openPlanner());
    act(() => result.current.start(makeCrawl(), ['First Pint']));
    expect(result.current.isCrawlMode).toBe(true);
    expect(result.current.isPlannerOpen).toBe(false);
    expect(result.current.routeFitKey).toBe(1);
    expect(result.current.crawl?.unlockedAtStart).toEqual(['First Pint']);
    expect(onEnterCrawl).toHaveBeenCalledWith(1, 'started');
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).id).toBe('crawl-1');
  });

  it('builds the route for the map, ticking off visited stops', () => {
    const { result } = renderSession({ 1: [makeVisit(1, '2026-11-15')] });
    act(() => result.current.start(makeCrawl({ startIsPub: false, startLabel: 'Leeds' }), []));
    expect(result.current.route).toEqual({
      start: { lat: samplePubs[0].lat, lon: samplePubs[0].lon, label: 'Leeds' },
      stops: [
        expect.objectContaining({ pubId: 1, number: 1, name: 'The Cuthbert Brodrick', done: true }),
        expect.objectContaining({ pubId: 2, number: 2, done: false }),
      ],
      streetPath: null,
    });
    expect(result.current.isDone(1)).toBe(true);
    expect(result.current.doneStopIds).toEqual(new Set([1]));
  });

  it('browses all pubs and comes back to the next stop not visited', () => {
    const { result, onEnterCrawl } = renderSession({ 1: [makeVisit(1, '2026-11-15')] });
    act(() => result.current.start(makeCrawl(), []));
    act(() => result.current.browse());
    expect(result.current.isCrawlMode).toBe(false);
    act(() => result.current.backToCrawl());
    expect(result.current.isCrawlMode).toBe(true);
    expect(onEnterCrawl).toHaveBeenLastCalledWith(2, 'returned');
  });

  it('comes back to the last stop when every stop is visited', () => {
    const { result, onEnterCrawl } = renderSession(bothVisited);
    act(() => result.current.start(makeCrawl(), []));
    act(() => result.current.browse());
    act(() => result.current.backToCrawl());
    expect(onEnterCrawl).toHaveBeenLastCalledWith(2, 'returned');
  });

  it('asks before ending, then ends, keeping nothing', () => {
    const { result } = renderSession();
    act(() => result.current.start(makeCrawl(), []));
    act(() => result.current.requestEnd());
    expect(result.current.isEndPending).toBe(true);
    act(() => result.current.cancelEnd());
    expect(result.current.isEndPending).toBe(false);
    act(() => result.current.requestEnd());
    act(() => result.current.end());
    expect(result.current.crawl).toBeNull();
    expect(result.current.history).toEqual([]);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('picks up a saved crawl, zooming to it', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(makeCrawl()));
    const { result } = renderSession();
    expect(result.current.crawl?.id).toBe('crawl-1');
    expect(result.current.routeFitKey).toBe(1);
  });

  it('restores a crawl from a backup and shows its route', () => {
    const { result } = renderSession();
    act(() => result.current.restore(makeCrawl({ id: 'restored' })));
    expect(result.current.crawl?.id).toBe('restored');
    expect(result.current.routeFitKey).toBe(1);
    act(() => result.current.showRoute());
    expect(result.current.routeFitKey).toBe(2);
  });

  it("does nothing going back to a crawl that isn't there", () => {
    const { result, onEnterCrawl } = renderSession();
    act(() => result.current.backToCrawl());
    expect(onEnterCrawl).not.toHaveBeenCalled();
    expect(result.current.isDone(1)).toBe(false);
  });

  describe('finishing', () => {
    it('counts a complete crawl towards achievements before it is finished', () => {
      const { result } = renderSession(bothVisited);
      act(() => result.current.start(makeCrawl(), []));
      expect(result.current.isComplete).toBe(true);
      expect(result.current.history).toEqual([]);
      expect(result.current.historyWithCurrent).toEqual([expect.objectContaining({ id: 'crawl-1', score: 70 })]);
    });

    it('keeps a finished crawl in the history', () => {
      const { result } = renderSession(bothVisited);
      act(() => result.current.start(makeCrawl(), []));
      act(() => result.current.finish());
      expect(result.current.crawl).toBeNull();
      expect(result.current.history).toEqual([expect.objectContaining({ id: 'crawl-1', pubCount: 2, meals: ['Breakfast'] })]);
      expect(JSON.parse(window.localStorage.getItem(HISTORY_KEY)!)).toHaveLength(1);
    });

    it("doesn't keep a crawl that wasn't completed", () => {
      const { result } = renderSession();
      act(() => result.current.start(makeCrawl(), []));
      act(() => result.current.finish());
      expect(result.current.history).toEqual([]);
    });

    it('adds finished crawls from a backup', () => {
      const { result } = renderSession();
      const done = { id: 'old', date: '2026-01-01', pubCount: 3, totalMiles: 1, mode: 'walk' as const, score: 90, meals: [], treasureHunt: false, revealedCount: 0 };
      act(() => result.current.restoreHistory([done]));
      act(() => result.current.restoreHistory([done]));
      expect(result.current.history).toEqual([done]);
    });
  });

  describe('treasure hunts', () => {
    it('keeps unfound stops off the map, and reveals them on request', () => {
      const { result } = renderSession({ 1: [makeVisit(1, '2026-11-15')] });
      act(() => result.current.start(makeCrawl({ treasureHunt: true, streetPath: [[53.8, -1.5]] }), []));
      expect(result.current.hiddenIds).toEqual(new Set([2]));
      expect(result.current.route?.stops.map((stop) => stop.pubId)).toEqual([1]);
      // The street route would give the hidden stop away
      expect(result.current.route?.streetPath).toBeNull();
      act(() => result.current.reveal(2));
      act(() => result.current.reveal(2));
      expect(result.current.crawl?.revealed).toEqual([2]);
      expect(result.current.hiddenIds).toEqual(new Set());
      expect(result.current.route?.streetPath).toEqual([[53.8, -1.5]]);
    });

    it("doesn't go back to a hidden stop on the map", () => {
      const { result, onEnterCrawl } = renderSession({ 1: [makeVisit(1, '2026-11-15')] });
      act(() => result.current.start(makeCrawl({ treasureHunt: true }), []));
      act(() => result.current.browse());
      act(() => result.current.backToCrawl());
      expect(result.current.isCrawlMode).toBe(true);
      expect(onEnterCrawl).toHaveBeenLastCalledWith(null, 'returned');
    });

    it("doesn't show a hidden first stop when the hunt starts", () => {
      const { result, onEnterCrawl } = renderSession();
      act(() => result.current.start(makeCrawl({ treasureHunt: true, startIsPub: false }), []));
      expect(onEnterCrawl).toHaveBeenCalledWith(null, 'started');
      // Starting at a pub, that pub is shown: the user chose it
      act(() => result.current.start(makeCrawl({ treasureHunt: true }), []));
      expect(onEnterCrawl).toHaveBeenLastCalledWith(1, 'started');
    });
  });

  describe('street routes', () => {
    afterEach(() => vi.useRealTimers());

    it('fetches the route between the pubs and retimes the crawl', async () => {
      vi.mocked(fetchStreetRoute).mockResolvedValue({ path: [[1, 2]], legs: [{ miles: 0.4, minutes: 10 }] });
      const { result } = renderSession();
      act(() => result.current.start(makeCrawl({ followStreets: true, startTime: 600 }), []));
      expect(result.current.streetRouteStatus).toBe('loading');
      await waitFor(() => expect(result.current.streetRouteStatus).toBe('done'));
      // Only the pubs' locations are sent
      expect(fetchStreetRoute).toHaveBeenCalledWith(
        [
          { lat: samplePubs[0].lat, lon: samplePubs[0].lon },
          { lat: samplePubs[1].lat, lon: samplePubs[1].lon },
        ],
        'walk',
      );
      expect(result.current.crawl?.stops[1]).toMatchObject({ legMiles: 0.4, arrive: 670 });
      expect(result.current.route?.streetPath).toEqual([[1, 2]]);
    });

    it('falls back to straight lines if the route cannot be had, not asking again', async () => {
      vi.mocked(fetchStreetRoute).mockRejectedValue(new Error('offline'));
      const { result, rerender } = renderSession();
      act(() => result.current.start(makeCrawl({ followStreets: true }), []));
      await waitFor(() => expect(result.current.streetRouteStatus).toBe('failed'));
      rerender({ visits: { 1: [makeVisit(1, '2026-11-15')] } });
      expect(fetchStreetRoute).toHaveBeenCalledOnce();
    });

    it("doesn't fetch routes for crawls not set to follow the streets", () => {
      const { result } = renderSession();
      act(() => result.current.start(makeCrawl(), []));
      expect(fetchStreetRoute).not.toHaveBeenCalled();
      expect(result.current.streetRouteStatus).toBe('none');
    });

    it('ignores a route arriving for a crawl since ended', async () => {
      let finish: (route: { path: Array<[number, number]>; legs: [] }) => void = () => {};
      vi.mocked(fetchStreetRoute).mockReturnValue(new Promise((resolve) => (finish = resolve)));
      const { result } = renderSession();
      act(() => result.current.start(makeCrawl({ followStreets: true }), []));
      act(() => result.current.end());
      await act(async () => finish({ path: [[1, 2]], legs: [] }));
      expect(result.current.crawl).toBeNull();
    });
  });
});
