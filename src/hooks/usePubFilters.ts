import { useMemo, useState } from 'react';
import type { PubLocation } from '../types';

export type VisitFilter = 'all' | 'visited' | 'unvisited';

// The visit filter the user last chose, so the app opens on it
const VISIT_FILTER_KEY = 'spoons-collector-visit-filter';
// Until they've chosen one, the list opens on the pubs they've visited
export const DEFAULT_VISIT_FILTER: VisitFilter = 'visited';

const readVisitFilter = (): VisitFilter => {
  try {
    const saved = window.localStorage.getItem(VISIT_FILTER_KEY);
    return saved === 'all' || saved === 'visited' || saved === 'unvisited' ? saved : DEFAULT_VISIT_FILTER;
  } catch {
    return DEFAULT_VISIT_FILTER;
  }
};

/** The pub list's search, region and visit filters, and its sort order */
export const usePubFilters = (locations: PubLocation[], visitedLocationIds: Set<number>) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [visitFilter, setVisitFilter] = useState<VisitFilter>(readVisitFilter);
  const [sortBy, setSortBy] = useState('name-asc');

  // The pubs that pass the search and filters, for the map and the list
  const filteredLocations = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return locations.filter((location) => {
      const matchesSearch =
        search.length === 0 ||
        `${location.name} ${location.city} ${location.region}`.toLowerCase().includes(search);
      const matchesRegion = selectedRegion === 'all' || location.region === selectedRegion;
      const isVisited = visitedLocationIds.has(location.id);
      const matchesVisitFilter =
        visitFilter === 'all' ||
        (visitFilter === 'visited' && isVisited) ||
        (visitFilter === 'unvisited' && !isVisited);
      return matchesSearch && matchesRegion && matchesVisitFilter;
    });
  }, [locations, searchTerm, selectedRegion, visitFilter, visitedLocationIds]);

  /**
   * Clears the search and filters (not the sort order), so every pub
   * shows. Used to show a pub the filters hide (a crawl stop, an arrival),
   * so it must show them all, not reset to a starting filter.
   */
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedRegion('all');
    setVisitFilter('all');
  };

  /**
   * The user choosing a visit filter: remembered for next time. (Filters
   * the app sets itself, e.g. for a crawl or Near me, aren't.)
   */
  const chooseVisitFilter = (filter: VisitFilter) => {
    setVisitFilter(filter);
    try {
      window.localStorage.setItem(VISIT_FILTER_KEY, filter);
    } catch {
      // Not remembered; it opens on the default next time
    }
  };

  return {
    searchTerm,
    setSearchTerm,
    selectedRegion,
    setSelectedRegion,
    visitFilter,
    setVisitFilter,
    chooseVisitFilter,
    sortBy,
    setSortBy,
    filteredLocations,
    clearFilters,
  };
};

export type PubFilters = ReturnType<typeof usePubFilters>;
