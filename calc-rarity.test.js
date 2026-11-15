import { describe, expect, it } from 'vitest';
import calculateRarity, { getDistance } from './calc-rarity.js';

// 1° of latitude is about 69.1 miles
const MILES_PER_DEGREE = 69.09;
const pubAt = (id, milesNorth) => ({ id, lat: 52 + milesNorth / MILES_PER_DEGREE, lon: -1.5 });

/** A pub with its nearest neighbour 0.5 miles away and the second at `second` miles */
const rarityWithSecondAt = (second) =>
  calculateRarity(pubAt(1, 0), [pubAt(1, 0), pubAt(2, 0.5), pubAt(3, second)]);

describe('calculateRarity', () => {
  it('rates by the distance to the second-nearest Spoons', () => {
    expect(rarityWithSecondAt(1).rarity).toBe('Common');
    expect(rarityWithSecondAt(3).rarity).toBe('Uncommon');
    expect(rarityWithSecondAt(5).rarity).toBe('Rare');
    expect(rarityWithSecondAt(10).rarity).toBe('Epic');
    expect(rarityWithSecondAt(20).rarity).toBe('Legendary');
  });

  it('makes an isolated pair rare, rather than each making the other common', () => {
    // Like Carlisle: two pubs side by side, the next 17 miles off
    const pair = [pubAt(1, 0), pubAt(2, 0.06), pubAt(3, 17)];
    expect(calculateRarity(pair[0], pair).rarity).toBe('Legendary');
  });

  it('records both distances, to 2 decimal places', () => {
    const result = rarityWithSecondAt(5);
    expect(result.nearestNeighborMiles).toBeCloseTo(0.5, 1);
    expect(result.secondNeighborMiles).toBeCloseTo(5, 1);
  });
});

describe('getDistance', () => {
  it('measures miles between two points', () => {
    // Along a line of longitude, 1° of latitude is 2π × 3958.8 / 360 miles
    expect(getDistance(52, -1.5, 53, -1.5)).toBeCloseTo(69.09, 2);
    expect(getDistance(52, -1.5, 52, -1.5)).toBe(0);
  });
});
