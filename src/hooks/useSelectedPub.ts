import { useEffect, useState } from 'react';
import type { PubLocation } from '../types';
import type { PubFilters } from './usePubFilters';

/** The pub selected on the map, kept among those the filters show */
export const useSelectedPub = (locations: PubLocation[], filters: PubFilters) => {
  const { filteredLocations } = filters;
  const [selectedId, setSelectedId] = useState<number>(locations[0]?.id ?? 0);

  const selectedPub =
    filteredLocations.find((location) => location.id === selectedId) ??
    filteredLocations[0] ??
    locations[0];

  // If the filters hide the selected pub, select the first one they show
  useEffect(() => {
    if (!filteredLocations.some((location) => location.id === selectedId)) {
      setSelectedId(filteredLocations[0]?.id ?? locations[0]?.id ?? 0);
    }
  }, [filteredLocations, selectedId, locations]);

  /**
   * Selects a pub even if the search or filters hide it, by clearing them;
   * otherwise the selection would jump straight back to a pub on the list.
   * For crawl stops, arrivals and the like, which can be anywhere.
   */
  const selectAnyPub = (pubId: number) => {
    if (!filteredLocations.some((location) => location.id === pubId)) {
      filters.clearFilters();
    }
    setSelectedId(pubId);
  };

  return { selectedId, selectedPub, select: setSelectedId, selectAnyPub };
};
