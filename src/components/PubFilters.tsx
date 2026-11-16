import type { VisitFilter } from '../hooks/usePubFilters';
import { plural } from '../utils';

type PubFiltersProps = {
  // How many pubs the search and filters leave
  count: number;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  // Every region in the dataset, so the menu doesn't shrink with the list
  regions: string[];
  selectedRegion: string;
  onRegionChange: (value: string) => void;
  visitFilter: VisitFilter;
  onVisitFilterChange: (value: VisitFilter) => void;
  onNearMe: () => void;
  locating: boolean;
  locationError: string | null;
};

/**
 * Near me, search, and the region and visit filters. They sit above the map
 * and the cards, as they choose the pubs both show.
 */
export const PubFilters = ({
  count,
  searchTerm,
  onSearchChange,
  regions,
  selectedRegion,
  onRegionChange,
  visitFilter,
  onVisitFilterChange,
  onNearMe,
  locating,
  locationError,
}: PubFiltersProps) => (
  <section className="card pub-filters" aria-label="Choose pubs">
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
    </div>

    <h2 className="pub-filters-count" aria-live="polite">
      Showing {plural(count, 'Wetherspoon pub')}
    </h2>

    {locationError && (
      <p className="near-me-error" role="alert">
        {locationError}
      </p>
    )}
  </section>
);
