import type { PubLocation, VisitEntry } from '../types';

/** A pub for tests. Only the fields given matter; the rest are filler. */
export const makePub = (
  id: number,
  lat: number,
  lon: number,
  extra: Partial<PubLocation> = {},
): PubLocation => ({
  id,
  osmId: id * 1000,
  name: `Pub ${id}`,
  city: 'Testville',
  postcode: 'TE1 1ST',
  lat,
  lon,
  website: 'NONE',
  menu: 'NONE',
  region: 'North West',
  imgUrl: null,
  imgType: null,
  history: '',
  rarity: 'Common',
  nearestNeighborMiles: 1,
  secondNeighborMiles: 2,
  ...extra,
});

export const makeVisit = (locationId: number, date: string, extra: Partial<VisitEntry> = {}): VisitEntry => ({
  id: `${locationId}-${date}`,
  locationId,
  date,
  rating: 2,
  ...extra,
});

// About 0.07 miles (110 m) per 0.001° of latitude
export const LAT_STEP = 0.001;
