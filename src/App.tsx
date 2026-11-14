import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { CardViewer } from './components/CardViewer';
import { SelectedPubBar } from './components/SelectedPubBar';
import { useBackButton } from './backButton';
import { isStopDone, loadCrawl, saveCrawl, type Crawl } from './crawl';
import { CrawlPlanner } from './components/CrawlPlanner';
import { CrawlPanel } from './components/CrawlPanel';
import type { CrawlRoute } from './components/Map';
import { crawlTrail, usePubTrail } from './trail';
import { unlockedTitles } from './achievements';
import { TrailNav } from './components/TrailNav';

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

const pubsById = new globalThis.Map(locations.map((location) => [location.id, location]));

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
  // Whether the selected pub's card is open full size
  const [isCardViewerOpen, setIsCardViewerOpen] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  // Whether the map fills the screen
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  // The Spoons crawl under way, if any
  const [crawl, setCrawl] = useState<Crawl | null>(() => loadCrawl(locations));
  const [isCrawlPlannerOpen, setIsCrawlPlannerOpen] = useState(false);
  const [isEndCrawlPending, setIsEndCrawlPending] = useState(false);
  // During a crawl the page shows only the map and the crawl ("crawl
  // mode"), unless the user chose to browse all the pubs meanwhile
  const [isBrowsingDuringCrawl, setIsBrowsingDuringCrawl] = useState(false);
  const isCrawlMode = crawl !== null && !isBrowsingDuringCrawl;
  // Bumped to make the map zoom to the whole crawl; starts at 1 so a crawl
  // under way is in view when the app opens
  const [routeFitKey, setRouteFitKey] = useState(() => (crawl ? 1 : 0));
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

  useEffect(() => {
    saveCrawl(crawl);
  }, [crawl]);


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
      // The list and its filters are hidden in crawl mode, so leave them be
      if (!isCrawlMode) {
        setSortBy('distance');
        setSearchTerm('');
        setSelectedRegion('all');
        setVisitFilter('unvisited');
      }
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

  // Selects a pub even if the search or filters hide it, by clearing them;
  // otherwise the selection would jump straight back to a pub on the list.
  // Used for crawl stops, which can be anywhere.
  const selectAnyPub = (locationId: number) => {
    if (!filteredLocations.some((location) => location.id === locationId)) {
      setSearchTerm('');
      setSelectedRegion('all');
      setVisitFilter('all');
    }
    setSelectedLocationId(locationId);
  };

  // Previous and Next nearest pub, following the search and filters
  const nearbyTrail = usePubTrail(selectedLocationId, filteredLocations, pubsById, selectAnyPub);
  // In crawl mode the arrows follow the crawl's stops in order instead
  const trail =
    isCrawlMode && crawl
      ? crawlTrail(
          crawl.stops.map((stop) => stop.pubId),
          new Set(
            crawl.stops
              .filter((stop) => isStopDone(crawl, stop.pubId, indexedVisits))
              .map((stop) => stop.pubId),
          ),
          selectedLocationId,
          pubsById,
          selectAnyPub,
        )
      : nearbyTrail;

  // ← and → step through nearby pubs, unless the user is typing, a form
  // or dialog is open, or they're panning the map with the keyboard
  const trailRef = useRef(trail);
  useEffect(() => {
    trailRef.current = trail;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, select, textarea, [contenteditable="true"]')) return;
      // On the map itself the arrows pan it; on a pub marker they step
      if (target.closest('.leaflet-container') && !target.closest('.leaflet-marker-icon')) return;
      if (document.querySelector('.visit-form-modal-backdrop')) return;
      // Stops the map panning as well when a marker has focus
      event.stopPropagation();
      event.preventDefault();
      if (event.key === 'ArrowRight') trailRef.current.goNext();
      else trailRef.current.goPrevious();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const scrollToMap = () => {
    if (!isMapExpanded) {
      mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const unlockedNow = useMemo(
    () => unlockedTitles(locations, visitedLocationIds, indexedVisits),
    [visitedLocationIds, indexedVisits],
  );

  const handleCrawlPlanned = (planned: Crawl) => {
    setCrawl({ ...planned, unlockedAtStart: unlockedNow });
    setIsCrawlPlannerOpen(false);
    setIsBrowsingDuringCrawl(false);
    // Crawl mode hides the list, so clear its search and filters, which
    // would otherwise hide pubs on the map with no visible reason
    setSearchTerm('');
    setSelectedRegion('all');
    setVisitFilter('all');
    setSelectedLocationId(planned.stops[0].pubId);
    setRouteFitKey((key) => key + 1);
    scrollToMap();
  };

  const showCrawlRoute = () => {
    setRouteFitKey((key) => key + 1);
    scrollToMap();
  };

  // Checking in at a stop opens the visit form for its pub
  const checkInAtStop = (pubId: number) => {
    selectAnyPub(pubId);
    openAddVisit();
  };

  const crawlRoute = useMemo<CrawlRoute | null>(() => {
    if (!crawl) return null;
    return {
      start: crawl.startIsPub
        ? null
        : { lat: crawl.startLat, lon: crawl.startLon, label: crawl.startLabel },
      stops: crawl.stops.flatMap((stop) => {
        const pub = pubsById.get(stop.pubId);
        return pub
          ? [{
              pubId: pub.id,
              lat: pub.lat,
              lon: pub.lon,
              name: pub.name,
              done: isStopDone(crawl, pub.id, indexedVisits),
            }]
          : [];
      }),
    };
  }, [crawl, indexedVisits]);

  // Selects a pub and opens its card full size
  const openCard = (locationId: number) => {
    setSelectedLocationId(locationId);
    setIsCardViewerOpen(true);
  };

  const closeCardViewer = useCallback(() => setIsCardViewerOpen(false), []);

  // Android's Back button shrinks the map rather than leaving the app
  useBackButton(() => setIsMapExpanded(false), isMapExpanded);

  // While the map fills the screen: Escape shrinks it, and the page behind
  // it can't scroll
  useEffect(() => {
    if (!isMapExpanded) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      // Escape closes a dialog open on top of the map first
      const dialogOpen = document.querySelector(
        '.visit-form-modal-backdrop, .card-viewer-backdrop',
      );
      if (event.key === 'Escape' && !dialogOpen) {
        setIsMapExpanded(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isMapExpanded]);

  // Closes the card and brings the map, now centred on the pub, into view
  const showSelectedOnMap = () => {
    setIsCardViewerOpen(false);
    if (!isMapExpanded) {
      mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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
    <div className={`app-shell ${isCrawlMode ? 'is-crawl-mode' : ''}`}>
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
              <button
                type="button"
                className="visit-form-close"
                onClick={() => setIsCrawlPlannerOpen(true)}
                // One crawl at a time: end or finish this one first
                disabled={isCrawlMode}
                title={isCrawlMode ? 'Finish or end this crawl to plan another' : undefined}
              >
                🍺 Plan a crawl
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

          {isCardViewerOpen && (
            <CardViewer
              pub={selectedLocation}
              rating={getRating(selectedLocation.id)}
              visitCount={getVisits(selectedLocation.id)}
              date={getVisitDate(selectedLocation.id)}
              distanceMiles={
                userPosition
                  ? distanceMiles(
                      userPosition.lat,
                      userPosition.lon,
                      selectedLocation.lat,
                      selectedLocation.lon,
                    )
                  : undefined
              }
              onAddVisit={() => {
                setIsCardViewerOpen(false);
                openAddVisit();
              }}
              onShowVisits={() => {
                setIsCardViewerOpen(false);
                setIsHistoryOpen(true);
              }}
              onShowOnMap={showSelectedOnMap}
              onClose={closeCardViewer}
              trail={trail}
            />
          )}

          {isCrawlPlannerOpen && (
            <CrawlPlanner
              locations={locations}
              visitedIds={visitedLocationIds}
              selectedPub={selectedLocation}
              today={getTodayDate()}
              hasCrawl={crawl !== null}
              onPlan={handleCrawlPlanned}
              onClose={() => setIsCrawlPlannerOpen(false)}
            />
          )}

          {isEndCrawlPending && (
            <ConfirmDialog
              title="End this crawl?"
              message="The route will be cleared. Visits you've logged on the way are kept."
              confirmLabel="End crawl"
              variant="danger"
              onConfirm={() => {
                setCrawl(null);
                setIsBrowsingDuringCrawl(false);
                setIsEndCrawlPending(false);
              }}
              onCancel={() => setIsEndCrawlPending(false)}
            />
          )}

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

          <div className="map-crawl-layout">
            <div
              className={`map-viewport-wrapper ${isMapExpanded ? 'is-expanded' : ''}`}
              ref={mapRef}
            >
              <Map
                locations={filteredLocations}
                visitedLocationIds={visitedLocationIds}
                selectedLocationId={selectedLocationId}
                onLocationSelect={selectAnyPub}
                initialBounds={initialMapBounds}
                userPosition={userPosition}
                expanded={isMapExpanded}
                onToggleExpanded={() => setIsMapExpanded((expanded) => !expanded)}
                onNearMe={handleNearMe}
                locating={locating}
                locationError={locationError}
                crawlRoute={crawlRoute}
                routeFitKey={routeFitKey}
              >
                <SelectedPubBar
                  pub={selectedLocation}
                  visitCount={getVisits(selectedLocation.id)}
                  date={getVisitDate(selectedLocation.id)}
                  trail={trail}
                  onOpen={() => setIsCardViewerOpen(true)}
                />
              </Map>

              {/* Hidden on phones, where the bar above shows instead */}
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
                compact={true}
                hasImage={Boolean(selectedLocation.imgType)}
                nearestMiles={selectedLocation.nearestNeighborMiles}
                secondMiles={selectedLocation.secondNeighborMiles}
                website={selectedLocation.website}
                menu={selectedLocation.menu}
                onClick={() => setIsCardViewerOpen(true)}
              />
              <div className="map-card-nav">
                <TrailNav trail={trail} variant="map" />
              </div>
            </div>
            {crawl && (
              <CrawlPanel
                crawl={crawl}
                pubsById={pubsById}
                indexedVisits={indexedVisits}
                onSelectPub={(pubId) => {
                  selectAnyPub(pubId);
                  scrollToMap();
                }}
                onCheckIn={checkInAtStop}
                onShowRoute={showCrawlRoute}
                onEnd={() => setIsEndCrawlPending(true)}
                onFinish={() => {
                  setCrawl(null);
                  setIsBrowsingDuringCrawl(false);
                }}
                isFocused={isCrawlMode}
                onBrowse={() => setIsBrowsingDuringCrawl(true)}
                onBackToCrawl={() => {
                  setIsBrowsingDuringCrawl(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                unlockedNow={unlockedNow}
              />
            )}
          </div>
          {!isCrawlMode && (
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
          )}
        </div>
        {!isCrawlMode && (
          <Visits
            locations={filteredLocations}
            regions={regions}
            indexedVisits={indexedVisits}
            onSelectLocation={handleSelectLocation}
            onOpenCard={openCard}
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
        )}
      </section>

      {!isCrawlMode && (
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
      )}
    </div>
  );
}

export default App;
