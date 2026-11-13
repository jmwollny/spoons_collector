import { useEffect, useMemo, useState } from 'react';
import type { PubLocation } from '../types';
import './SelectLocation.css';

type SelectLocationProps = {
  locations: PubLocation[];
  selectedLocationId: number;
  disabled?: boolean;
  onSelect: (locationId: number) => void;
  // Told whether the search matches any pub, so a form can't be submitted
  // for a pub that isn't shown
  onHasMatchesChange?: (hasMatches: boolean) => void;
};

const byNameThenTown = (a: PubLocation, b: PubLocation) =>
  a.name.localeCompare(b.name) || a.city.localeCompare(b.city);

const filterLocations = (locations: PubLocation[], text: string) => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return locations;
  }
  return locations.filter((location) =>
    `${location.name} ${location.city}`.toLowerCase().includes(normalized),
  );
};

/**
 * Picks a pub: a search box over an A-Z list. Typing narrows the list and
 * selects the first match.
 */
export const SelectLocation = ({
  locations,
  selectedLocationId,
  disabled = false,
  onSelect,
  onHasMatchesChange,
}: SelectLocationProps) => {
  const [query, setQuery] = useState('');

  const sortedLocations = useMemo(() => [...locations].sort(byNameThenTown), [locations]);

  const matches = useMemo(
    () => filterLocations(sortedLocations, query),
    [sortedLocations, query],
  );

  const hasMatches = matches.length > 0;
  useEffect(() => {
    onHasMatchesChange?.(hasMatches);
  }, [hasMatches, onHasMatchesChange]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    const newMatches = filterLocations(sortedLocations, text);
    // Keep the selection inside the list being shown
    if (newMatches.length && !newMatches.some((location) => location.id === selectedLocationId)) {
      onSelect(newMatches[0].id);
    }
  };

  return (
    <div className="select-location">
      {!disabled && (
        <label>
          Pub
          <input
            type="search"
            placeholder="Search pub or town"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            onKeyDown={(event) => {
              // Enter would submit the visit form before the pub is checked
              if (event.key === 'Enter') {
                event.preventDefault();
              }
            }}
          />
        </label>
      )}
      {matches.length ? (
        <select
          aria-label="Pub"
          value={selectedLocationId}
          onChange={(event) => onSelect(Number(event.target.value))}
          disabled={disabled}
        >
          {matches.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name} · {location.city}
            </option>
          ))}
        </select>
      ) : (
        <p className="select-location-empty">No pubs match “{query.trim()}”.</p>
      )}
    </div>
  );
};
