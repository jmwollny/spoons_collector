import { describe, expect, it } from 'vitest';
import { legacyStorageKey, loadVisits, reconcileVisits, storageKey } from './visits';
import { makePub, makeVisit } from './test/pubs';

const storageWith = (items: Record<string, unknown>) => ({
  getItem: (key: string) => (key in items ? JSON.stringify(items[key]) : null),
});

// Wetherspoon id 1783 used to be recorded as OSM id 1783000 (see makePub)
const pubs = [makePub(1783, 53.8, -1.55), makePub(1786, 53.801, -1.55)];

describe('loadVisits', () => {
  it('reads saved visits', () => {
    const visits = [makeVisit(1783, '2026-11-01')];
    expect(loadVisits(pubs, storageWith({ [storageKey]: visits }))).toEqual(visits);
  });

  it('converts v1 visits from OSM ids to Wetherspoon ids', () => {
    const legacy = [makeVisit(1783000, '2026-01-01'), makeVisit(1786000, '2026-02-01')];
    expect(
      loadVisits(pubs, storageWith({ [legacyStorageKey]: legacy })).map((visit) => visit.locationId),
    ).toEqual([1783, 1786]);
  });

  it('drops v1 visits whose pub is no longer in the data', () => {
    const legacy = [makeVisit(1783000, '2026-01-01'), makeVisit(999000, '2026-02-01')];
    expect(loadVisits(pubs, storageWith({ [legacyStorageKey]: legacy }))).toHaveLength(1);
  });

  it('prefers v2 visits over v1', () => {
    const v2 = [makeVisit(1786, '2026-03-01')];
    const v1 = [makeVisit(1783000, '2026-01-01')];
    expect(loadVisits(pubs, storageWith({ [storageKey]: v2, [legacyStorageKey]: v1 }))).toEqual(v2);
  });

  it('starts empty', () => {
    expect(loadVisits(pubs, storageWith({}))).toEqual([]);
  });
});

describe('reconcileVisits', () => {
  const visits = [makeVisit(1783, '2026-11-02'), makeVisit(1786, '2026-11-01')];

  it('brings the visits back when local storage was cleared', () => {
    expect(reconcileVisits([], visits)).toEqual({ visits, addedCount: 2 });
  });

  it('changes nothing when the two copies match', () => {
    expect(reconcileVisits(visits, visits)).toEqual({ visits, addedCount: 0 });
  });

  it('keeps the local version of a visit that differs', () => {
    const edited = { ...visits[0], rating: 0 };
    const result = reconcileVisits([edited, visits[1]], visits);
    expect(result.visits.find((visit) => visit.id === edited.id)?.rating).toBe(0);
  });

  it('copes with no second copy yet', () => {
    expect(reconcileVisits(visits, null)).toEqual({ visits, addedCount: 0 });
  });
});
