import { useEffect, useMemo, useState } from 'react';
import type { PubLocation, VisitEntry } from '../types';
import { formatDate } from '../utils';
import { loadVisits, loadVisitsCopy, reconcileVisits, saveVisitsCopy, storageKey } from '../visits';

/** A pub's visits at a glance */
export type PubVisitStats = {
  count: number;
  // The latest visit's rating, or -1 if never visited
  rating: number;
  // The latest visit's date, formatted for display
  date: string | null;
};

/**
 * The user's visits: kept in state, saved to local storage and to a second
 * copy (see visits.ts), and indexed for the rest of the app.
 */
export const useVisits = (locations: PubLocation[]) => {
  const [visits, setVisits] = useState<VisitEntry[]>(() =>
    loadVisits(locations, window.localStorage),
  );
  // Until the second copy has been read, saving to it would overwrite it
  // with what may be an empty list
  const [isCopyLoaded, setIsCopyLoaded] = useState(false);

  // When the app opens, the copy brings back any visits missing from local
  // storage, e.g. if Android cleared the web view's storage
  useEffect(() => {
    loadVisitsCopy()
      .then((copy) => setVisits((current) => reconcileVisits(current, copy).visits))
      .catch(() => {
        // No copy to restore from; local storage is all there is
      })
      .finally(() => setIsCopyLoaded(true));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(visits));
    if (isCopyLoaded) {
      void saveVisitsCopy(visits);
    }
  }, [visits, isCopyLoaded]);

  const visitedLocationIds = useMemo(
    () => new Set(visits.map((visit) => visit.locationId)),
    [visits],
  );

  // Counts only pubs still in the data, not visits to pubs since closed
  const uniqueVisitedCount = useMemo(
    () => locations.filter((location) => visitedLocationIds.has(location.id)).length,
    [locations, visitedLocationIds],
  );

  // Each pub's visits, newest first, so [0] is always the latest visit
  const indexedVisits = useMemo(() => {
    const byPub = visits.reduce<Record<number, VisitEntry[]>>((acc, visit) => {
      if (!acc[visit.locationId]) acc[visit.locationId] = [];
      acc[visit.locationId].push(visit);
      return acc;
    }, {});
    for (const pubVisits of Object.values(byPub)) {
      pubVisits.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    }
    return byPub;
  }, [visits]);

  const statsFor = (pubId: number): PubVisitStats => {
    const latest = indexedVisits[pubId]?.[0];
    return {
      count: indexedVisits[pubId]?.length ?? 0,
      rating: latest?.rating ?? -1,
      date: latest ? formatDate(latest.date) : null,
    };
  };

  const addVisit = (pubId: number, date: string, rating: number) =>
    setVisits((current) => [
      { id: `${pubId}-${Date.now()}`, locationId: pubId, date, rating },
      ...current,
    ]);

  const updateVisit = (visitId: string, date: string, rating: number) =>
    setVisits((current) =>
      current.map((visit) => (visit.id === visitId ? { ...visit, date, rating } : visit)),
    );

  const deleteVisit = (visitId: string) =>
    setVisits((current) => current.filter((visit) => visit.id !== visitId));

  return {
    visits,
    setVisits,
    visitedLocationIds,
    uniqueVisitedCount,
    indexedVisits,
    statsFor,
    addVisit,
    updateVisit,
    deleteVisit,
  };
};

export type VisitsApi = ReturnType<typeof useVisits>;
