import { useMemo, useState } from 'react';
import type { PubLocation } from '../types';

export type VisitFilter = 'all' | 'visited' | 'unvisited';

/** The pub list's search, region and visit filters, and its sort order */
export const usePubFilters = (locations: PubLocation[], visitedLocationIds: Set<number>) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [visitFilter, setVisitFilter] = useState<VisitFilter>('all');
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

  /** Clears the search and filters (not the sort order) */
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedRegion('all');
    setVisitFilter('all');
  };

  return {
    searchTerm,
    setSearchTerm,
    selectedRegion,
    setSelectedRegion,
    visitFilter,
    setVisitFilter,
    sortBy,
    setSortBy,
    filteredLocations,
    clearFilters,
  };
};

export type PubFilters = ReturnType<typeof usePubFilters>;
