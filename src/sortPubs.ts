import type { PubLocation, VisitEntry } from './types';

export type SortOrder =
  | 'distance'
  | 'name-asc'
  | 'name-desc'
  | 'rarity-desc'
  | 'rarity-asc'
  | 'rating-desc'
  | 'rating-asc'
  | 'date-desc'
  | 'date-asc';

/** The sort orders offered in the list, in menu order */
export const SORT_OPTIONS: Array<{ value: SortOrder; label: string; needsPosition?: boolean }> = [
  { value: 'distance', label: 'Distance (nearest first)', needsPosition: true },
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'rarity-desc', label: 'Rarity (Legendary first)' },
  { value: 'rarity-asc', label: 'Rarity (Common first)' },
  { value: 'rating-desc', label: 'Rating (Highest first)' },
  { value: 'rating-asc', label: 'Rating (Lowest first)' },
  { value: 'date-desc', label: 'Visit Date (Recent first)' },
  { value: 'date-asc', label: 'Visit Date (Oldest first)' },
];

const RARITY_WEIGHTS: Record<string, number> = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Epic: 4,
  Legendary: 5,
};

const byName = (a: PubLocation, b: PubLocation) => a.name.localeCompare(b.name);

/**
 * The pubs in the chosen order. Ties, and pubs without what's being sorted
 * on, go by name. Pubs never visited come after visited ones when sorting
 * by rating or visit date, whichever the direction.
 *
 * @param indexedVisits each pub's visits, newest first
 * @param distances miles from the user to each pub, once known
 */
export const sortPubs = (
  pubs: PubLocation[],
  sortBy: string,
  indexedVisits: Record<number, VisitEntry[]>,
  distances: Map<number, number> | null,
): PubLocation[] => {
  const latest = (pub: PubLocation) => indexedVisits[pub.id]?.[0];
  const weight = (pub: PubLocation) => RARITY_WEIGHTS[pub.rarity] || 0;

  // Visited pubs first (by `compare`), then the rest by name
  const visitedFirst =
    (compare: (a: VisitEntry, b: VisitEntry) => number) => (a: PubLocation, b: PubLocation) => {
      const visitA = latest(a);
      const visitB = latest(b);
      if (visitA && !visitB) return -1;
      if (!visitA && visitB) return 1;
      if (!visitA || !visitB) return byName(a, b);
      return compare(visitA, visitB) || byName(a, b);
    };

  const comparators: Record<string, (a: PubLocation, b: PubLocation) => number> = {
    'name-asc': byName,
    'name-desc': (a, b) => b.name.localeCompare(a.name),
    'rarity-desc': (a, b) => weight(b) - weight(a) || byName(a, b),
    'rarity-asc': (a, b) => weight(a) - weight(b) || byName(a, b),
    // Unvisited pubs count as below the lowest rating, so come last
    'rating-desc': (a, b) =>
      (latest(b)?.rating ?? -2) - (latest(a)?.rating ?? -2) || byName(a, b),
    'rating-asc': visitedFirst((a, b) => a.rating - b.rating),
    'date-desc': visitedFirst((a, b) => b.date.localeCompare(a.date)),
    'date-asc': visitedFirst((a, b) => a.date.localeCompare(b.date)),
  };

  if (sortBy === 'distance' && distances) {
    return [...pubs].sort((a, b) => (distances.get(a.id) ?? 0) - (distances.get(b.id) ?? 0));
  }
  const compare = comparators[sortBy];
  return compare ? [...pubs].sort(compare) : [...pubs];
};
