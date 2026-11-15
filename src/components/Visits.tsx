import { useMemo } from 'react';
import type { PubLocation, VisitEntry } from '../types';
import type { Position } from '../location';
import type { VisitFilter } from '../hooks/usePubFilters';
import { distanceMiles } from '../utils';
import { sortPubs } from '../sortPubs';
import { CollectionToolbar } from './CollectionToolbar';
import { GalleryCard } from './GalleryCard';
import { VirtualCardGrid } from './VirtualCardGrid';
import './Visits.css';

const NO_VISITS: VisitEntry[] = [];

type VisitsProps = {
  // The pubs the search and filters show
  locations: PubLocation[];
  // Every region in the dataset, so the menu doesn't shrink with the list
  regions: string[];
  // Each pub's visits, newest first
  indexedVisits: Record<number, VisitEntry[]>;
  // Selects a pub (centring the map on it) and opens its card full size
  onOpenCard: (locationId: number) => void;
  selectedLocationId: number;
  searchTerm: string;
  selectedRegion: string;
  visitFilter: VisitFilter;
  onSearchChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onVisitFilterChange: (value: VisitFilter) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  // Where the user is, once they've used Near me
  userPosition: Position | null;
  onNearMe: () => void;
  locating: boolean;
  locationError: string | null;
};

/** The list of pubs as cards, with its search, filters and sort order */
export const Visits = ({
  locations,
  regions,
  indexedVisits,
  onOpenCard,
  selectedLocationId,
  searchTerm,
  selectedRegion,
  visitFilter,
  onSearchChange,
  onRegionChange,
  onVisitFilterChange,
  sortBy,
  onSortChange,
  userPosition,
  onNearMe,
  locating,
  locationError,
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
      <div className="section-heading">
        <h2>
          Showing {sortedPubs.length} Wetherspoon {sortedPubs.length === 1 ? 'pub' : 'pubs'}
        </h2>
      </div>

      <CollectionToolbar
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        regions={regions}
        selectedRegion={selectedRegion}
        onRegionChange={onRegionChange}
        visitFilter={visitFilter}
        onVisitFilterChange={onVisitFilterChange}
        sortBy={sortBy}
        onSortChange={onSortChange}
        canSortByDistance={userPosition !== null}
        onNearMe={onNearMe}
        locating={locating}
      />

      {locationError && (
        <p className="near-me-error" role="alert">
          {locationError}
        </p>
      )}

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
        scrollResetKey={`${searchTerm}|${selectedRegion}|${visitFilter}|${sortBy}`}
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
