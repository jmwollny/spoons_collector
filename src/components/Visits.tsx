import { useMemo } from 'react';
import type { PubLocation, VisitEntry } from '../types';
import type { Position } from '../location';
import { distanceMiles } from '../utils';
import { SORT_OPTIONS, sortPubs } from '../sortPubs';
import { GalleryCard } from './GalleryCard';
import { VirtualCardGrid } from './VirtualCardGrid';
import './Visits.css';

const NO_VISITS: VisitEntry[] = [];

type VisitsProps = {
  // The pubs the search and filters show
  locations: PubLocation[];
  // Each pub's visits, newest first
  indexedVisits: Record<number, VisitEntry[]>;
  // Selects a pub and opens its card full size
  onOpenCard: (locationId: number) => void;
  selectedLocationId: number;
  sortBy: string;
  onSortChange: (value: string) => void;
  // Changes with the search and filters (in PubFilters), so a new search
  // starts from the top of the list
  filterKey: string;
  // Where the user is, once they've used Near me
  userPosition: Position | null;
};

/** The pubs as cards, in the order chosen. PubFilters chooses which pubs. */
export const Visits = ({
  locations,
  indexedVisits,
  onOpenCard,
  selectedLocationId,
  sortBy,
  onSortChange,
  filterKey,
  userPosition,
}: VisitsProps) => {
  // Miles from the user to each pub, once their position is known
  const distances = useMemo(() => {
    if (!userPosition) {
      return null;
    }
    return new Map(
      locations.map((pub) => [
        pub.id,
        distanceMiles(userPosition.lat, userPosition.lon, pub.lat, pub.lon),
      ]),
    );
  }, [locations, userPosition]);

  const sortedPubs = useMemo(
    () => sortPubs(locations, sortBy, indexedVisits, distances),
    [locations, sortBy, indexedVisits, distances],
  );

  return (
    <div className="card collection-gallery-card">
      <div className="visits-heading">
        <h2>Cards</h2>
        <select
          className="collection-filter collection-filter--sort"
          aria-label="Sort by"
          value={sortBy}
          onChange={(event) => onSortChange(event.target.value)}
        >
          {SORT_OPTIONS.filter((option) => userPosition !== null || !option.needsPosition).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Only the cards on screen are drawn (see VirtualCardGrid) */}
      <VirtualCardGrid
        className="visits-cards-grid"
        items={sortedPubs}
        getKey={(pub) => pub.id}
        // 14rem
        minColumnWidth={224}
        gap={16}
        estimatedRowHeight={420}
        pageScrollQuery="(max-width: 600px)"
        // A new search, filter or sort starts from the top of the list
        scrollResetKey={`${filterKey}|${sortBy}`}
        renderItem={(pub) => (
          <GalleryCard
            pub={pub}
            visits={indexedVisits[pub.id] ?? NO_VISITS}
            isSelected={pub.id === selectedLocationId}
            distanceMiles={distances?.get(pub.id)}
            onOpen={onOpenCard}
          />
        )}
      />
    </div>
  );
};
