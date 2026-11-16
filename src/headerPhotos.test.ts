import { describe, expect, it } from 'vitest';
import { pickHeaderPubs } from './headerPhotos';
import type { PubLocation } from './types';
import { makeVisit } from './test/pubs';

const pub = (id: number, imgType: string | null = 'jpg') => ({ id, imgType }) as PubLocation;
const locations = Array.from({ length: 20 }, (_, index) => pub(index + 1, index === 1 ? null : 'jpg'));
const pubsById = new Map(locations.map((each) => [each.id, each]));
const ids = (pubs: PubLocation[]) => pubs.map((each) => each.id);

describe('pickHeaderPubs', () => {
  it("puts the user's pubs first, latest first, each once", () => {
    const visits = [makeVisit(7, '2026-11-03'), makeVisit(3, '2026-11-02'), makeVisit(7, '2026-11-01')];
    expect(ids(pickHeaderPubs(visits, locations, pubsById, 4)).slice(0, 2)).toEqual([7, 3]);
  });

  it('fills up with pubs spread across the list, leaving out those without a photo', () => {
    const chosen = pickHeaderPubs([makeVisit(2, '2026-11-01')], locations, pubsById, 5);
    expect(ids(chosen)).toEqual([1, 5, 8, 11, 14]);
  });

  it('stops at the number asked for', () => {
    const visits = locations.map((each) => makeVisit(each.id, '2026-11-01'));
    expect(pickHeaderPubs(visits, locations, pubsById, 3)).toHaveLength(3);
  });
});
