import { vi } from 'vitest';
import type { Crawl } from '../crawl';
import type { PubTrail, TrailStep } from '../trail';
import { makePub } from './pubs';

export { makePub, makeVisit } from './pubs';

/** A handful of pubs in two towns and regions, of different rarities */
export const leeds1 = makePub(1, 53.8018, -1.5478, {
  name: 'The Cuthbert Brodrick',
  city: 'Leeds',
  region: 'Yorkshire and The Humber',
  rarity: 'Common',
  history: 'Named after the architect of Leeds Town Hall.',
  imgType: 'jpg',
  website: 'https://example.com/cuthbert',
  menu: 'https://example.com/cuthbert/menu',
});
export const leeds2 = makePub(2, 53.8019, -1.5459, {
  name: 'The Hedley Verity',
  city: 'Leeds',
  region: 'Yorkshire and The Humber',
  rarity: 'Uncommon',
});
export const york = makePub(3, 53.959, -1.0827, {
  name: 'The Punch Bowl',
  city: 'York',
  region: 'Yorkshire and The Humber',
  rarity: 'Epic',
});
export const glasgow = makePub(4, 55.8642, -4.2518, {
  name: 'The Counting House',
  city: 'Glasgow',
  region: 'Scotland',
  rarity: 'Legendary',
});
export const samplePubs = [leeds1, leeds2, york, glasgow];
export const samplePubsById = new Map(samplePubs.map((pub) => [pub.id, pub]));

/** A two-stop crawl around Leeds, on 15 Nov 2026 */
export const makeCrawl = (overrides: Partial<Crawl> = {}): Crawl => ({
  id: 'crawl-1',
  date: '2026-11-15',
  style: 'new',
  mode: 'walk',
  stayMinutes: 60,
  startLabel: 'The Cuthbert Brodrick, Leeds',
  startLat: leeds1.lat,
  startLon: leeds1.lon,
  startIsPub: true,
  stops: [
    { pubId: 1, legMiles: 0, arrive: 600, meal: 'Breakfast', wasNew: true },
    { pubId: 2, legMiles: 0.1, arrive: 665, meal: null, wasNew: true },
  ],
  ...overrides,
});

const step = (pub = leeds2, miles = 0.1, stopNumber?: number): TrailStep => ({ pub, miles, stopNumber });

/** Previous and Next, with spies for stepping */
export const makeTrail = (overrides: Partial<PubTrail> = {}): PubTrail => ({
  mode: 'nearby',
  previous: null,
  next: step(),
  goPrevious: vi.fn(),
  goNext: vi.fn(),
  ...overrides,
});

export { step as trailStep };
