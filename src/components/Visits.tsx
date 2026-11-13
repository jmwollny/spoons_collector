import { useMemo } from 'react';
import SpoonCard from './SpoonCard';
import type { PubLocation, VisitEntry } from '../types';
import './Visits.css';
import { distanceMiles, formatDate } from '../utils';
import type { Position } from '../location';

type VisitFilter = 'all' | 'visited' | 'unvisited';

type VisitsProps = {
  locations: PubLocation[];
  // Every region in the dataset, so the dropdown doesn't shrink to match the filtered list
  regions: string[];
  indexedVisits: Record<number, VisitEntry[]>;
  onSelectLocation?: (locationId: number) => void;
  selectedLocationId?: number;
  searchTerm?: string;
  selectedRegion?: string;
  visitFilter?: VisitFilter;
  onSearchChange?: (value: string) => void;
  onRegionChange?: (value: string) => void;
  onVisitFilterChange?: (value: VisitFilter) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  // Where the user is, once they've used Near me
  userPosition: Position | null;
  onNearMe: () => void;
  locating: boolean;
  locationError: string | null;
};

const RARITY_WEIGHTS: Record<string, number> = {
  'Common': 1,
  'Uncommon': 2,
  'Rare': 3,
  'Epic': 4,
  'Legendary': 5,
};

export const Visits = ({
  locations,
  regions,
  indexedVisits,
  onSelectLocation,
  selectedLocationId,
  searchTerm = '',
  selectedRegion = 'all',
  visitFilter = 'all',
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

  const getVisitDate = (id: number): string | null => {
    const pubHistory = indexedVisits[id];
    if (!pubHistory) {
      return null;
    }
    const visitDate = pubHistory[0].date;
    return formatDate(visitDate);
  };

  const processedLocations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    // 1. Filter the locations
    const filtered = locations.filter((pub) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        `${pub.name} ${pub.city} ${pub.region}`.toLowerCase().includes(normalizedSearch);

      const matchesRegion =
        selectedRegion === 'all' || pub.region === selectedRegion;

      const isVisited = Boolean(indexedVisits[pub.id]?.length);
      const matchesVisitFilter =
        visitFilter === 'all' ||
        (visitFilter === 'visited' && isVisited) ||
        (visitFilter === 'unvisited' && !isVisited);

      return matchesSearch && matchesRegion && matchesVisitFilter;
    });

    // 2. Sort the filtered locations
    return filtered.sort((a, b) => {
      if (sortBy === 'distance' && distances) {
        return (distances.get(a.id) ?? 0) - (distances.get(b.id) ?? 0);
      }
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === 'rarity-desc') {
        const wA = RARITY_WEIGHTS[a.rarity] || 0;
        const wB = RARITY_WEIGHTS[b.rarity] || 0;
        if (wA !== wB) return wB - wA;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'rarity-asc') {
        const wA = RARITY_WEIGHTS[a.rarity] || 0;
        const wB = RARITY_WEIGHTS[b.rarity] || 0;
        if (wA !== wB) return wA - wB;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'rating-desc') {
        const rA = indexedVisits[a.id]?.[0]?.rating ?? -2;
        const rB = indexedVisits[b.id]?.[0]?.rating ?? -2;
        if (rA !== rB) return rB - rA;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'rating-asc') {
        const hasA = (indexedVisits[a.id]?.length ?? 0) > 0;
        const hasB = (indexedVisits[b.id]?.length ?? 0) > 0;
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        if (!hasA && !hasB) return a.name.localeCompare(b.name);

        const rA = indexedVisits[a.id][0].rating;
        const rB = indexedVisits[b.id][0].rating;
        if (rA !== rB) return rA - rB;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'date-desc') {
        const hasA = (indexedVisits[a.id]?.length ?? 0) > 0;
        const hasB = (indexedVisits[b.id]?.length ?? 0) > 0;
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        if (!hasA && !hasB) return a.name.localeCompare(b.name);

        const dA = indexedVisits[a.id][0].date;
        const dB = indexedVisits[b.id][0].date;
        if (dA !== dB) return dB.localeCompare(dA);
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'date-asc') {
        const hasA = (indexedVisits[a.id]?.length ?? 0) > 0;
        const hasB = (indexedVisits[b.id]?.length ?? 0) > 0;
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        if (!hasA && !hasB) return a.name.localeCompare(b.name);

        const dA = indexedVisits[a.id][0].date;
        const dB = indexedVisits[b.id][0].date;
        if (dA !== dB) return dA.localeCompare(dB);
        return a.name.localeCompare(b.name);
      }
      return 0;
    });
  }, [locations, searchTerm, selectedRegion, visitFilter, indexedVisits, sortBy, distances]);

  return (
    <div className="card collection-gallery-card">
      <div className="section-heading">
        <h2>Showing {processedLocations.length} Wetherspoon Pubs</h2>
      </div>

      <div className="collection-toolbar">
        <button
          type="button"
          className="near-me-button"
          onClick={onNearMe}
          disabled={locating}
        >
          {locating ? 'Finding you…' : '📍 Near me'}
        </button>
        <input
          type="search"
          className="collection-search"
          placeholder="Search pub or city"
          value={searchTerm}
          onChange={(event) => onSearchChange?.(event.target.value)}
        />
        <select
          className="collection-filter"
          value={selectedRegion}
          onChange={(event) => onRegionChange?.(event.target.value)}
        >
          <option value="all">All regions</option>
          {regions.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
        <select
          className="collection-filter"
          value={visitFilter}
          onChange={(event) =>
            onVisitFilterChange?.(event.target.value as VisitFilter)
          }
        >
          <option value="all">All visits</option>
          <option value="visited">Visited</option>
          <option value="unvisited">Unvisited</option>
        </select>
        <select
          className="collection-filter"
          value={sortBy}
          onChange={(event) => onSortChange(event.target.value)}
        >
          {userPosition && <option value="distance">Distance (nearest first)</option>}
          <option value="name-asc">Name (A-Z)</option>
          <option value="name-desc">Name (Z-A)</option>
          <option value="rarity-desc">Rarity (Legendary first)</option>
          <option value="rarity-asc">Rarity (Common first)</option>
          <option value="rating-desc">Rating (Highest first)</option>
          <option value="rating-asc">Rating (Lowest first)</option>
          <option value="date-desc">Visit Date (Recent first)</option>
          <option value="date-asc">Visit Date (Oldest first)</option>
        </select>
      </div>

      {locationError && (
        <p className="near-me-error" role="alert">
          {locationError}
        </p>
      )}

      {/* Grid container to wrap the dynamic list of cards */}
      <div className="visits-cards-grid">
        {processedLocations.map((pub) => {
          const pubHistory = indexedVisits[pub.id] || [];
          // Extract the rating from the most recent visit to this location
          const latestRating = pubHistory[0]?.rating ?? -1;

          return (
            <div key={pub.id} className="gallery-card-wrapper">
              <button
                type="button"
                className="visits-card-button"
                onClick={() => onSelectLocation?.(pub.id)}
              >
                <SpoonCard
                  id={pub.id}
                  name={pub.name}
                  city={pub.city}
                  region={pub.region}
                  rarity={pub.rarity}
                  rating={latestRating}
                  history={pub.history}
                  visited={pubHistory.length > 0}
                  hasImage={Boolean(pub.imgType)}
                  medium={true}
                  selected={selectedLocationId === pub.id}
                  date={getVisitDate(pub.id)}
                  distanceMiles={distances?.get(pub.id)}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

