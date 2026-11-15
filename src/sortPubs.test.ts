import { describe, expect, it } from 'vitest';
import { SORT_OPTIONS, sortPubs } from './sortPubs';
import { makePub, makeVisit } from './test/fixtures';

// Names chosen so A-Z order differs from each other order
const alpha = makePub(1, 0, 0, { name: 'Alpha', rarity: 'Rare' });
const bravo = makePub(2, 0, 0, { name: 'Bravo', rarity: 'Legendary' });
const charlie = makePub(3, 0, 0, { name: 'Charlie', rarity: 'Common' });
const delta = makePub(4, 0, 0, { name: 'Delta', rarity: 'Rare' });
const pubs = [charlie, alpha, delta, bravo];

// Alpha: rated 1 on 1 Oct; Charlie: rated 2 on 1 Nov; Delta: rated 1 on 1 Sep
const visits = {
  1: [makeVisit(1, '2026-10-01', { rating: 1 })],
  3: [makeVisit(3, '2026-11-01', { rating: 2 })],
  4: [makeVisit(4, '2026-09-01', { rating: 1 })],
};

const order = (sortBy: string, distances: Map<number, number> | null = null) =>
  sortPubs(pubs, sortBy, visits, distances).map((pub) => pub.name);

describe('sortPubs', () => {
  it('sorts by name either way', () => {
    expect(order('name-asc')).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
    expect(order('name-desc')).toEqual(['Delta', 'Charlie', 'Bravo', 'Alpha']);
  });

  it('sorts by rarity either way, then by name', () => {
    expect(order('rarity-desc')).toEqual(['Bravo', 'Alpha', 'Delta', 'Charlie']);
    expect(order('rarity-asc')).toEqual(['Charlie', 'Alpha', 'Delta', 'Bravo']);
  });

  it('sorts by rating, putting unvisited pubs last either way', () => {
    expect(order('rating-desc')).toEqual(['Charlie', 'Alpha', 'Delta', 'Bravo']);
    expect(order('rating-asc')).toEqual(['Alpha', 'Delta', 'Charlie', 'Bravo']);
  });

  it('sorts by visit date, putting unvisited pubs last either way', () => {
    expect(order('date-desc')).toEqual(['Charlie', 'Alpha', 'Delta', 'Bravo']);
    expect(order('date-asc')).toEqual(['Delta', 'Alpha', 'Charlie', 'Bravo']);
  });

  it('orders unvisited pubs by name among themselves', () => {
    const unvisited = [delta, bravo];
    expect(sortPubs(unvisited, 'date-desc', {}, null).map((pub) => pub.name)).toEqual(['Bravo', 'Delta']);
  });

  it('sorts by distance once known, falling back to the list as given', () => {
    const distances = new Map([
      [1, 5],
      [2, 1],
      [3, 3],
      [4, 2],
    ]);
    expect(order('distance', distances)).toEqual(['Bravo', 'Delta', 'Charlie', 'Alpha']);
    expect(order('distance')).toEqual(['Charlie', 'Alpha', 'Delta', 'Bravo']);
  });

  it('treats an unknown rarity as least rare', () => {
    const odd = makePub(5, 0, 0, { name: 'Echo', rarity: 'Mythic' });
    expect(sortPubs([odd, charlie], 'rarity-asc', {}, null).map((pub) => pub.name)).toEqual(['Echo', 'Charlie']);
  });

  it("leaves the order alone for an unknown sort, and doesn't change the list given", () => {
    expect(order('mystery')).toEqual(['Charlie', 'Alpha', 'Delta', 'Bravo']);
    sortPubs(pubs, 'name-asc', visits, null);
    expect(pubs.map((pub) => pub.name)).toEqual(['Charlie', 'Alpha', 'Delta', 'Bravo']);
  });

  it('offers distance only with a position, and every other order', () => {
    expect(SORT_OPTIONS.filter((option) => option.needsPosition).map((option) => option.value)).toEqual([
      'distance',
    ]);
    expect(SORT_OPTIONS).toHaveLength(9);
  });
});
