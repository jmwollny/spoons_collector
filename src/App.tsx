import { useEffect, useMemo, useState } from 'react';
import './App.css';
import spoons from '../assets/spoons_enriched.json';
import { Map } from './components/Map';
import SpoonCard from './components/SpoonCard';
import type { PubLocation, VisitEntry } from './types';
import { VisitForm } from './components/VisitForm';
import { Visits } from './components/Visits';
import { ActionButton } from './components/ActionButton';
import StarRating from './components/StarRating';
import { distanceMiles, formatDate } from './utils';
import { getCurrentLocation, type Position } from './location';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Achievements } from './components/Achievements';
import { RarityProgress } from './components/RarityProgress';
import { RegionBreakdown } from './components/RegionBreakdown';
import { BackupPanel } from './components/BackupPanel';
import { VisitHistory } from './components/VisitHistory';

type VisitFilter = 'all' | 'visited' | 'unvisited';

// v1 recorded visits against OSM ids; v2 records them against Wetherspoon ids
const storageKey = 'spoons-collector-v2';
const legacyStorageKey = 'spoons-collector-v1';

// The app identifies pubs by Wetherspoon's own id (jdwId) rather than the OSM
// id, which changes whenever a mapper redraws a pub and would orphan the
// visits recorded against it. The pipeline warns about any pub without one.
const locations: PubLocation[] = spoons
  .filter((spoon) => spoon.jdwId)
  .map(({ id, jdwId, ...spoon }) => ({ ...spoon, id: jdwId, osmId: id }));

/**
 * Reads the saved visits. The first time this version runs, visits saved by
 * v1 are converted from OSM ids to Wetherspoon ids. The v1 entry is left in
 * place, so nothing is lost if a visit's pub is no longer in the data.
 */
const loadVisits = (): VisitEntry[] => {
  const saved = window.localStorage.getItem(storageKey);
  if (saved) {
    return JSON.parse(saved) as VisitEntry[];
  }

  const legacy = window.localStorage.getItem(legacyStorageKey);
  if (!legacy) {
    return [];
  }

  const idsByOsmId = new globalThis.Map(
    locations.map((location) => [location.osmId, location.id]),
  );
  return (JSON.parse(legacy) as VisitEntry[]).flatMap((visit) => {
    const id = idsByOsmId.get(visit.locationId);
    return id === undefined ? [] : [{ ...visit, locationId: id }];
  });
};

const regions = Array.from(
  new Set(locations.map((location) => location.region)),
).sort();

// The map opens showing every pub
const initialMapBounds: [[number, number], [number, number]] = [
  [Math.min(...locations.map((location) => location.lat)), Math.min(...locations.map((location) => location.lon))],
  [Math.max(...locations.map((location) => location.lat)), Math.max(...locations.map((location) => location.lon))],
];

function App() {
  const [visits, setVisits] = useState<VisitEntry[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    return loadVisits();
  });
  // Local date as YYYY-MM-DD. toISOString() is UTC, which is still "yesterday"
  // for the first hour after midnight during British Summer Time.
  const getTodayDate = () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  };

  const getDefaultForm = () => ({
    date: getTodayDate(),
    rating: -1,
  });

  const [form, setForm] = useState(getDefaultForm());
  const [selectedLocationId, setSelectedLocationId] = useState<number>(
    locations[0]?.id ?? 0,
  );
  const [isVisitFormOpen, setIsVisitFormOpen] = useState(false);
  // The visit being edited in the form, or null when adding a new one
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  // The visit waiting for the user to confirm its deletion
  const [visitPendingDelete, setVisitPendingDelete] = useState<VisitEntry | null>(null);
  const [sortBy, setSortBy] = useState('name-asc');
  const [userPosition, setUserPosition] = useState<Position | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [visitFilter, setVisitFilter] = useState<VisitFilter>('all');

  // Save the visits array into local storage when the visits array is updated.
  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(visits));
  }, [visits]);


  const visitedLocationIds = useMemo(
    () => new Set(visits.map((visit) => visit.locationId)),
    [visits],
  );
  // Counts only pubs still in the data, not visits to pubs since closed
  const uniqueVisitedCount = useMemo(
    () => locations.filter((location) => visitedLocationIds.has(location.id)).length,
    [visitedLocationIds],
  );
  const totalLocations = locations.length;
  const completionPercentage = Math.round(
    (uniqueVisitedCount / totalLocations) * 100,
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

  // Date of the latest visit to a pub, formatted for display
  const getVisitDate = (id: number): string | null => {
    const latest = indexedVisits[id]?.[0];
    return latest ? formatDate(latest.date) : null;
  };

  const filteredLocations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return locations.filter((location) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        `${location.name} ${location.city} ${location.region}`
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesRegion =
        selectedRegion === 'all' || location.region === selectedRegion;

      const isVisited = visitedLocationIds.has(location.id);
      const matchesVisitFilter =
        visitFilter === 'all' ||
        (visitFilter === 'visited' && isVisited) ||
        (visitFilter === 'unvisited' && !isVisited);

      return matchesSearch && matchesRegion && matchesVisitFilter;
    });
  }, [searchTerm, selectedRegion, visitFilter, visitedLocationIds]);

  const selectedLocation =
    filteredLocations.find((location) => location.id === selectedLocationId) ??
    filteredLocations[0] ??
    locations[0];

  const openAddVisit = () => {
    setEditingVisitId(null);
    setForm(getDefaultForm());
    setIsVisitFormOpen(true);
  };

  // Opens the form filled in with one of the selected pub's visits
  const openEditVisit = (visit: VisitEntry) => {
    setIsHistoryOpen(false);
    setEditingVisitId(visit.id);
    setForm({ date: visit.date, rating: visit.rating });
    setIsVisitFormOpen(true);
  };

  /**
   * Near me: finds the user, then lists the unvisited pubs nearest first and
   * selects the closest one, which centres the map on it.
   */
  const handleNearMe = async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const position = await getCurrentLocation();
      const nearest = locations
        .filter((location) => !visitedLocationIds.has(location.id))
        .reduce<{ id: number; miles: number } | null>((closest, location) => {
          const miles = distanceMiles(position.lat, position.lon, location.lat, location.lon);
          return !closest || miles < closest.miles ? { id: location.id, miles } : closest;
        }, null);

      setUserPosition(position);
      setSortBy('distance');
      setSearchTerm('');
      setSelectedRegion('all');
      setVisitFilter('unvisited');
      if (nearest) {
        setSelectedLocationId(nearest.id);
      }
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : String(error));
    } finally {
      setLocating(false);
    }
  };

  const closeVisitForm = () => {
    setIsVisitFormOpen(false);
    setEditingVisitId(null);
    setForm(getDefaultForm());
  };

  /**
   * Handle the form submission. Save the visit details to the browser's local storage.
   */
  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedLocationId || !form.date) {
      return;
    }

    if (editingVisitId) {
      setVisits((current) =>
        current.map((visit) =>
          visit.id === editingVisitId
            ? { ...visit, date: form.date, rating: form.rating }
            : visit,
        ),
      );
    } else {
      const entry: VisitEntry = {
        id: `${selectedLocationId}-${Date.now()}`,
        locationId: selectedLocationId,
        date: form.date,
        rating: form.rating,
      };
      setVisits((current) => [entry, ...current]);
    }

    closeVisitForm();
  };

  function onRatingUpdated(rating: number): void {
    setForm((current) => ({ ...current, rating: rating }));
  }

  const handleSelectLocation = (locationId: number) => {
    setSelectedLocationId(locationId);
  };

  useEffect(() => {
    if (!filteredLocations.some((location) => location.id === selectedLocationId)) {
      setSelectedLocationId(filteredLocations[0]?.id ?? locations[0]?.id ?? 0);
    }
  }, [filteredLocations, selectedLocationId]);

  const getVisits = (id: number) => {
    const visitsBySelectedLocation = indexedVisits[id];
    return !visitsBySelectedLocation ? 0 : visitsBySelectedLocation.length;
  };

  const hasVisitsForSelectedLocation = Boolean(
    indexedVisits[selectedLocationId]?.length,
  );

  const handleDeleteVisit = () => {
    if (!visitPendingDelete) {
      return;
    }
    const remaining = (indexedVisits[visitPendingDelete.locationId]?.length ?? 1) - 1;
    setVisits((current) => current.filter((visit) => visit.id !== visitPendingDelete.id));
    setVisitPendingDelete(null);
    if (remaining === 0) {
      setIsHistoryOpen(false);
    }
  };

  const selectedVisitCount = indexedVisits[selectedLocationId]?.length ?? 0;

  const getRating = (id: number): number => {
    const visitsBySelectedLocation = indexedVisits[id];
    return !visitsBySelectedLocation ? -1 : visitsBySelectedLocation[0].rating;
  };

  return (
    <div className="app-shell">
      <section className="dashboard-split">
        <div className="card map-card">
          <header className="hero-card">
            <div>
              <h1>Spoons Collector</h1>
              <p className="hero-copy">Log your visits and rate each pub.</p>
            </div>
          </header>
          <div className="map-selector-container">
            <div className="map-selector-actions">
              <ActionButton variant="primary" onClick={openAddVisit}>
                Add visit
              </ActionButton>
              <button
                type="button"
                className="visit-form-close"
                onClick={() => setIsHistoryOpen(true)}
                disabled={!hasVisitsForSelectedLocation}
              >
                Visits ({selectedVisitCount})
              </button>

              {selectedLocation && (
                <div className={`selected-visit-details ${!hasVisitsForSelectedLocation ? 'is-unvisited' : ''}`}>
                  {hasVisitsForSelectedLocation && indexedVisits[selectedLocationId]?.[0] ? (
                    <>
                      <span className="details-value">
                        {selectedLocation.name}
                      </span>
                      <span className="details-divider">·</span>
                      <strong className="details-value">
                        {getVisitDate(selectedLocation.id)}
                      </strong>
                      <span className="details-divider">·</span>
                      <StarRating
                        rating={indexedVisits[selectedLocationId][0].rating}
                        maxRating={3}
                        disabled={true}
                        size={14}
                      />
                      {selectedVisitCount > 1 && (
                        <>
                          <span className="details-divider">·</span>
                          <span className="details-value">{selectedVisitCount} visits</span>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="details-value">
                        {selectedLocation.name}
                      </span>
                      <span className="details-divider">·</span>
                      <span className="details-unvisited">Not visited yet</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {isHistoryOpen && hasVisitsForSelectedLocation && (
            <VisitHistory
              pubName={selectedLocation.name}
              visits={indexedVisits[selectedLocationId]}
              onAdd={() => {
                setIsHistoryOpen(false);
                openAddVisit();
              }}
              onEdit={openEditVisit}
              onDelete={setVisitPendingDelete}
              onClose={() => setIsHistoryOpen(false)}
            />
          )}

          {visitPendingDelete && (
            <ConfirmDialog
              title="Delete visit?"
              message={
                <>
                  Your visit to <strong>{selectedLocation.name}</strong> on{' '}
                  {formatDate(visitPendingDelete.date)} and its rating will be deleted.
                  This can't be undone.
                </>
              }
              confirmLabel="Delete visit"
              variant="danger"
              onConfirm={handleDeleteVisit}
              onCancel={() => setVisitPendingDelete(null)}
            />
          )}

          {isVisitFormOpen && (
            <div
              className="visit-form-modal-backdrop"
              onClick={closeVisitForm}
            >
              <div
                className="visit-form-modal"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="visit-form-modal-header">
                  <h2>{editingVisitId ? 'Edit visit' : 'Add visit'}</h2>
                  <button
                    type="button"
                    className="visit-form-close"
                    onClick={closeVisitForm}
                  >
                    Close
                  </button>
                </div>
                <VisitForm
                  locations={locations}
                  selectedLocationId={selectedLocationId}
                  form={form}
                  setForm={setForm}
                  onLocationSelected={handleSelectLocation}
                  onRatingUpdated={onRatingUpdated}
                  onSubmit={handleSubmit}
                  isEditing={editingVisitId !== null}
                  maxDate={getTodayDate()}
                />
              </div>
            </div>
          )}

          <div className="map-viewport-wrapper">
            <Map
              locations={filteredLocations}
              visitedLocationIds={visitedLocationIds}
              selectedLocationId={selectedLocationId}
              onLocationSelect={setSelectedLocationId}
              initialBounds={initialMapBounds}
              userPosition={userPosition}
            />

            {/* <div className="map-card-overlay"> */}
            <SpoonCard
              id={selectedLocation.id}
              name={selectedLocation.name}
              city={selectedLocation.city}
              region={selectedLocation.region}
              rarity={selectedLocation.rarity}
              rating={getRating(selectedLocationId)}
              history={selectedLocation.history}
              visited={getVisits(selectedLocation.id) > 0}
              visitCount={getVisits(selectedLocation.id)}
              date={getVisitDate(selectedLocationId)}
              small={true}
              hasImage={Boolean(selectedLocation.imgType)}
              nearestMiles={selectedLocation.nearestNeighborMiles}
              secondMiles={selectedLocation.secondNeighborMiles}
              website={selectedLocation.website}
              menu={selectedLocation.menu}
            />
            {/* </div> */}
          </div>
          <div className="hero-metrics">
            <div className="metric-card">
              <strong>{uniqueVisitedCount}</strong>
              <span>Visited Spoons</span>
            </div>
            <div className="metric-card">
              <strong>{completionPercentage}%</strong>
              <span>Completion</span>
            </div>
          </div>
        </div>
        <Visits
          locations={filteredLocations}
          regions={regions}
          indexedVisits={indexedVisits}
          onSelectLocation={handleSelectLocation}
          selectedLocationId={selectedLocationId}
          searchTerm={searchTerm}
          selectedRegion={selectedRegion}
          visitFilter={visitFilter}
          onSearchChange={setSearchTerm}
          onRegionChange={setSelectedRegion}
          onVisitFilterChange={setVisitFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
          userPosition={userPosition}
          onNearMe={handleNearMe}
          locating={locating}
          locationError={locationError}
        />
      </section>

      <section className="progress-grid">
        <Achievements
          locations={locations}
          visitedLocationIds={visitedLocationIds}
          indexedVisits={indexedVisits}
        />
        <RarityProgress locations={locations} visitedLocationIds={visitedLocationIds} />
        <RegionBreakdown locations={locations} visitedLocationIds={visitedLocationIds} />
        <BackupPanel visits={visits} onVisitsChange={setVisits} today={getTodayDate()} />
      </section>
    </div>
  );
}

export default App;
