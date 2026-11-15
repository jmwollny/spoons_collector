import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Preferences } from '@capacitor/preferences';
import { useVisits } from './useVisits';
import { makeVisit, samplePubs } from '../test/fixtures';
import { storageKey } from '../visits';

const copyKey = 'visits-v2';

// Saving the second copy finishes in the background, so let it land, then
// clear it, or it would leak into the next test
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Preferences.clear();
});

describe('useVisits', () => {
  it('loads saved visits and indexes them, newest first', async () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify([makeVisit(1, '2026-10-01'), makeVisit(1, '2026-11-01', { id: 'b' }), makeVisit(2, '2026-09-01')]),
    );
    const { result } = renderHook(() => useVisits(samplePubs));
    await waitFor(() => expect(result.current.visits).toHaveLength(3));
    expect(result.current.indexedVisits[1].map((visit) => visit.date)).toEqual(['2026-11-01', '2026-10-01']);
    expect(result.current.visitedLocationIds).toEqual(new Set([1, 2]));
    expect(result.current.uniqueVisitedCount).toBe(2);
  });

  it("doesn't count visits to pubs no longer in the data", async () => {
    window.localStorage.setItem(storageKey, JSON.stringify([makeVisit(999, '2026-10-01')]));
    const { result } = renderHook(() => useVisits(samplePubs));
    await waitFor(() => expect(result.current.visits).toHaveLength(1));
    expect(result.current.uniqueVisitedCount).toBe(0);
  });

  it('sums up a pub: visits, latest rating and date', async () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify([makeVisit(1, '2026-10-01', { rating: 0 }), makeVisit(1, '2026-11-14', { id: 'b', rating: 2 })]),
    );
    const { result } = renderHook(() => useVisits(samplePubs));
    await waitFor(() => expect(result.current.statsFor(1).count).toBe(2));
    expect(result.current.statsFor(1)).toEqual({ count: 2, rating: 2, date: '14 Nov 2026' });
    expect(result.current.statsFor(3)).toEqual({ count: 0, rating: -1, date: null });
  });

  it('adds, edits and deletes visits, saving them', async () => {
    const { result } = renderHook(() => useVisits(samplePubs));
    act(() => result.current.addVisit(3, '2026-11-15', 1));
    const added = result.current.visits[0];
    expect(added).toMatchObject({ locationId: 3, date: '2026-11-15', rating: 1 });
    act(() => result.current.updateVisit(added.id, '2026-11-14', 2));
    expect(result.current.visits[0]).toMatchObject({ date: '2026-11-14', rating: 2 });
    expect(JSON.parse(window.localStorage.getItem(storageKey)!)).toHaveLength(1);
    act(() => result.current.deleteVisit(added.id));
    expect(result.current.visits).toEqual([]);
  });

  it('keeps a second copy, and restores from it if local storage was cleared', async () => {
    const first = renderHook(() => useVisits(samplePubs));
    await waitFor(async () => expect((await Preferences.get({ key: copyKey })).value).toBe('[]'));
    act(() => first.result.current.addVisit(2, '2026-11-15', 2));
    await waitFor(async () => expect((await Preferences.get({ key: copyKey })).value).toContain('"locationId":2'));
    first.unmount();

    // Android clears the web view's storage, but not the app's own
    window.localStorage.removeItem(storageKey);
    const second = renderHook(() => useVisits(samplePubs));
    await waitFor(() => expect(second.result.current.visits).toHaveLength(1));
    expect(second.result.current.visits[0].locationId).toBe(2);
  });

  it("doesn't overwrite the copy with an empty list before reading it", async () => {
    await Preferences.set({ key: copyKey, value: JSON.stringify([makeVisit(4, '2026-11-01')]) });
    const { result } = renderHook(() => useVisits(samplePubs));
    await waitFor(() => expect(result.current.visits).toHaveLength(1));
    expect((await Preferences.get({ key: copyKey })).value).toContain('"locationId":4');
  });
});
