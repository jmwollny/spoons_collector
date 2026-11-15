import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCrawlSession } from './useCrawlSession';
import { makeCrawl, makeVisit, samplePubs, samplePubsById } from '../test/fixtures';
import type { VisitEntry } from '../types';

const STORAGE_KEY = 'spoons-collector-crawl-v1';

const renderSession = (indexedVisits: Record<number, VisitEntry[]> = {}, unlockedNow: string[] = []) => {
  const onEnterCrawl = vi.fn();
  const hook = renderHook(
    ({ visits }) =>
      useCrawlSession({
        locations: samplePubs,
        pubsById: samplePubsById,
        indexedVisits: visits,
        unlockedNow,
        onEnterCrawl,
      }),
    { initialProps: { visits: indexedVisits } },
  );
  return { ...hook, onEnterCrawl };
};

describe('useCrawlSession', () => {
  it('starts with no crawl', () => {
    const { result } = renderSession();
    expect(result.current.crawl).toBeNull();
    expect(result.current.isCrawlMode).toBe(false);
    expect(result.current.route).toBeNull();
    expect(result.current.routeFitKey).toBe(0);
  });

  it('opens and closes the planner', () => {
    const { result } = renderSession();
    act(() => result.current.openPlanner());
    expect(result.current.isPlannerOpen).toBe(true);
    act(() => result.current.closePlanner());
    expect(result.current.isPlannerOpen).toBe(false);
  });

  it('starts a crawl: crawl mode, the route shown, achievements recorded', () => {
    const { result, onEnterCrawl } = renderSession({}, ['First Pint']);
    act(() => result.current.openPlanner());
    act(() => result.current.start(makeCrawl()));
    expect(result.current.isCrawlMode).toBe(true);
    expect(result.current.isPlannerOpen).toBe(false);
    expect(result.current.routeFitKey).toBe(1);
    expect(result.current.crawl?.unlockedAtStart).toEqual(['First Pint']);
    expect(onEnterCrawl).toHaveBeenCalledWith(1, 'started');
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).id).toBe('crawl-1');
  });

  it('builds the route for the map, ticking off visited stops', () => {
    const { result } = renderSession({ 1: [makeVisit(1, '2026-11-15')] });
    act(() => result.current.start(makeCrawl({ startIsPub: false, startLabel: 'Leeds' })));
    expect(result.current.route).toEqual({
      start: { lat: samplePubs[0].lat, lon: samplePubs[0].lon, label: 'Leeds' },
      stops: [
        expect.objectContaining({ pubId: 1, name: 'The Cuthbert Brodrick', done: true }),
        expect.objectContaining({ pubId: 2, done: false }),
      ],
    });
    expect(result.current.isDone(1)).toBe(true);
    expect(result.current.doneStopIds).toEqual(new Set([1]));
  });

  it('browses all pubs and comes back to the next stop not visited', () => {
    const { result, onEnterCrawl } = renderSession({ 1: [makeVisit(1, '2026-11-15')] });
    act(() => result.current.start(makeCrawl()));
    act(() => result.current.browse());
    expect(result.current.isCrawlMode).toBe(false);
    expect(result.current.crawl).not.toBeNull();
    act(() => result.current.backToCrawl());
    expect(result.current.isCrawlMode).toBe(true);
    expect(onEnterCrawl).toHaveBeenLastCalledWith(2, 'returned');
  });

  it('comes back to the last stop when every stop is visited', () => {
    const visited = { 1: [makeVisit(1, '2026-11-15')], 2: [makeVisit(2, '2026-11-15')] };
    const { result, onEnterCrawl } = renderSession(visited);
    act(() => result.current.start(makeCrawl()));
    act(() => result.current.browse());
    act(() => result.current.backToCrawl());
    expect(onEnterCrawl).toHaveBeenLastCalledWith(2, 'returned');
  });

  it('asks before ending, then ends, keeping nothing', () => {
    const { result } = renderSession();
    act(() => result.current.start(makeCrawl()));
    act(() => result.current.requestEnd());
    expect(result.current.isEndPending).toBe(true);
    act(() => result.current.cancelEnd());
    expect(result.current.isEndPending).toBe(false);
    act(() => result.current.requestEnd());
    act(() => result.current.end());
    expect(result.current.crawl).toBeNull();
    expect(result.current.isEndPending).toBe(false);
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
});
