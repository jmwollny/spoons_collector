import type { VisitFilter } from '../hooks/usePubFilters';
import { SORT_OPTIONS } from '../sortPubs';

type CollectionToolbarProps = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  // Every region in the dataset, so the menu doesn't shrink with the list
  regions: string[];
  selectedRegion: string;
  onRegionChange: (value: string) => void;
  visitFilter: VisitFilter;
  onVisitFilterChange: (value: VisitFilter) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  // Distance sorting needs the user's position, from Near me
  canSortByDistance: boolean;
  onNearMe: () => void;
  locating: boolean;
};

/** Near me, search, region and visit filters, and sort order for the pub list */
export const CollectionToolbar = ({
  searchTerm,
  onSearchChange,
  regions,
  selectedRegion,
  onRegionChange,
  visitFilter,
  onVisitFilterChange,
  sortBy,
  onSortChange,
  canSortByDistance,
  onNearMe,
  locating,
}: CollectionToolbarProps) => (
  <div className="collection-toolbar">
    <div className="collection-search-row">
      <button type="button" className="near-me-button" onClick={onNearMe} disabled={locating}>
        {locating ? 'Finding you…' : '📍 Near me'}
      </button>
      <input
        type="search"
        className="collection-search"
        placeholder="Search pub or city"
        aria-label="Search pub or city"
        value={searchTerm}
        onChange={(event) => onSearchChange(event.target.value)}
      />
    </div>
    <select
      className="collection-filter collection-filter--region"
      aria-label="Region"
      value={selectedRegion}
      onChange={(event) => onRegionChange(event.target.value)}
    >
      <option value="all">All regions</option>
      {regions.map((region) => (
        <option key={region} value={region}>
          {region}
        </option>
      ))}
    </select>
    <select
      className="collection-filter collection-filter--visits"
      aria-label="Visited or not"
      value={visitFilter}
      onChange={(event) => onVisitFilterChange(event.target.value as VisitFilter)}
    >
      <option value="all">All visits</option>
      <option value="visited">Visited</option>
      <option value="unvisited">Unvisited</option>
    </select>
    <select
      className="collection-filter collection-filter--sort"
      aria-label="Sort by"
      value={sortBy}
      onChange={(event) => onSortChange(event.target.value)}
    >
      {SORT_OPTIONS.filter((option) => canSortByDistance || !option.needsPosition).map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);
