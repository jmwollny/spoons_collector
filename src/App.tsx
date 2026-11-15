import { useCallback, useMemo, useRef, useState } from 'react';
import './App.css';
import type { VisitEntry } from './types';
import { initialMapBounds, locations, pubsById, regions } from './data';
import { distanceMiles, formatDate, todayDate } from './utils';
import { sanitiseCrawl } from './crawl';
import { unlockedTitles } from './achievements';
import { useBackup } from './backupReminder';
import { useVisits } from './hooks/useVisits';
import { usePubFilters } from './hooks/usePubFilters';
import { useSelectedPub } from './hooks/useSelectedPub';
import { useVisitEditor } from './hooks/useVisitEditor';
import { useCrawlSession } from './hooks/useCrawlSession';
import { useNearMe } from './hooks/useNearMe';
import { useLiveArrival } from './hooks/useLiveArrival';
import { useMapExpanded } from './hooks/useMapExpanded';
import { useActiveTrail } from './hooks/useActiveTrail';
import { Map } from './components/Map';
import SpoonCard from './components/SpoonCard';
import { Visits } from './components/Visits';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Achievements } from './components/Achievements';
import { RarityProgress } from './components/RarityProgress';
import { RegionBreakdown } from './components/RegionBreakdown';
import { BackupPanel } from './components/BackupPanel';
import { BackupReminder } from './components/BackupReminder';
import { VisitHistory } from './components/VisitHistory';
import { VisitFormModal } from './components/VisitFormModal';
import { CardViewer } from './components/CardViewer';
import { SelectedPubBar } from './components/SelectedPubBar';
import { SelectedPubSummary } from './components/SelectedPubSummary';
import { MapToolbar } from './components/MapToolbar';
import { VisitMetrics } from './components/VisitMetrics';
import { CrawlPlanner } from './components/CrawlPlanner';
import { CrawlPanel } from './components/CrawlPanel';
import { ArrivalBanner } from './components/ArrivalBanner';
import { TrailNav } from './components/TrailNav';

function App() {
  const today = todayDate();

  // ---- Visits, and which pubs are shown and selected ----
  const visitsApi = useVisits(locations);
  const { visits, visitedLocationIds, indexedVisits, statsFor } = visitsApi;
  const filters = usePubFilters(locations, visitedLocationIds);
  const { selectedId, selectedPub, select, selectAnyPub } = useSelectedPub(locations, filters);
  const selectedStats = statsFor(selectedPub.id);
  const editor = useVisitEditor(selectedId, visitsApi);

  // ---- Dialogs and overlays ----
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCardViewerOpen, setIsCardViewerOpen] = useState(false);
  // The visit waiting for the user to confirm its deletion
  const [visitPendingDelete, setVisitPendingDelete] = useState<VisitEntry | null>(null);
  const mapExpanded = useMapExpanded();
  const mapRef = useRef<HTMLDivElement>(null);

  // Scrolls once the page has updated, as what's shown above the map can
  // change at the same moment (e.g. starting a crawl hides the backup
  // reminder), which would leave the scroll short or overshooting
  const scrollToMap = (block: ScrollLogicalPosition = 'start') => {
    if (!mapExpanded.isExpanded) {
      requestAnimationFrame(() => mapRef.current?.scrollIntoView({ behavior: 'smooth', block }));
    }
  };

  // ---- Crawls ----
  const unlockedNow = useMemo(
    () => unlockedTitles(locations, visitedLocationIds, indexedVisits),
    [visitedLocationIds, indexedVisits],
  );
  const crawl = useCrawlSession({
    locations,
    pubsById,
    indexedVisits,
    unlockedNow,
    // Crawl mode hides the list, so clear its search and filters, which
    // would otherwise hide pubs on the map with no visible reason
    onEnterCrawl: (pubId, how) => {
      filters.clearFilters();
      select(pubId);
      if (how === 'started') {
        scrollToMap();
      } else {
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      }
    },
  });

  // ---- Finding the user ----
  const nearMe = useNearMe(locations, visitedLocationIds, (_position, nearestPubId) => {
    // The list and its filters are hidden in crawl mode, so leave them be
    if (!crawl.isCrawlMode) {
      filters.setSortBy('distance');
      filters.clearFilters();
      filters.setVisitFilter('unvisited');
    }
    if (nearestPubId !== null) {
      select(nearestPubId);
    }
  });

  const live = useLiveArrival({
    locations,
    pubsById,
    selectedId,
    crawl: crawl.crawl,
    isCrawlMode: crawl.isCrawlMode,
    isCheckedInToday: (pubId) =>
      Boolean(indexedVisits[pubId]?.some((visit) => visit.date === today)),
    selectAnyPub,
  });

  // ---- Previous and Next ----
  const trail = useActiveTrail(selectedId, filters.filteredLocations, pubsById, crawl, selectAnyPub);

  const backup = useBackup(visits, crawl.crawl, today);

  // ---- Actions ----
  const openCard = (pubId: number) => {
    select(pubId);
    setIsCardViewerOpen(true);
  };
  const closeCardViewer = useCallback(() => setIsCardViewerOpen(false), []);

  // Selects a pub anywhere, then opens the Add visit form for it
  const checkInAt = (pubId: number) => {
    selectAnyPub(pubId);
    editor.openAdd();
  };

  const handleDeleteVisit = () => {
    if (!visitPendingDelete) return;
    const remaining = (indexedVisits[visitPendingDelete.locationId]?.length ?? 1) - 1;
    visitsApi.deleteVisit(visitPendingDelete.id);
    setVisitPendingDelete(null);
    if (remaining === 0) {
      setIsHistoryOpen(false);
    }
  };

  const { isCrawlMode } = crawl;

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

          {backup.isReminderDue && !isCrawlMode && (
            <BackupReminder backup={backup} visitCount={visits.length} today={today} />
          )}

          <MapToolbar
            onAddVisit={editor.openAdd}
            visitCount={selectedStats.count}
            onShowVisits={() => setIsHistoryOpen(true)}
            onPlanCrawl={crawl.openPlanner}
            canPlanCrawl={!isCrawlMode}
            isLiveLocationOn={live.isOn}
            onToggleLiveLocation={live.toggle}
          >
            <SelectedPubSummary pub={selectedPub} visits={indexedVisits[selectedPub.id] ?? []} />
          </MapToolbar>

          {live.error && (
            <p className="near-me-error" role="alert">
              {live.error}
            </p>
          )}

          {live.bannerPub && (
            <ArrivalBanner
              pub={live.bannerPub}
              crawlStop={live.crawlStop}
              onShow={() => {
                selectAnyPub(live.bannerPub!.id);
                scrollToMap();
              }}
              onCheckIn={() => checkInAt(live.bannerPub!.id)}
              onDismiss={() => live.dismiss(live.bannerPub!.id)}
            />
          )}

          {isCardViewerOpen && (
            <CardViewer
              pub={selectedPub}
              rating={selectedStats.rating}
              visitCount={selectedStats.count}
              date={selectedStats.date}
              distanceMiles={
                nearMe.userPosition
                  ? distanceMiles(
                      nearMe.userPosition.lat,
                      nearMe.userPosition.lon,
                      selectedPub.lat,
                      selectedPub.lon,
                    )
                  : undefined
              }
              onAddVisit={() => {
                setIsCardViewerOpen(false);
                editor.openAdd();
              }}
              onShowVisits={() => {
                setIsCardViewerOpen(false);
                setIsHistoryOpen(true);
              }}
              onShowOnMap={() => {
                setIsCardViewerOpen(false);
                scrollToMap('center');
              }}
              onClose={closeCardViewer}
              trail={trail}
            />
          )}

          {crawl.isPlannerOpen && (
            <CrawlPlanner
              locations={locations}
              visitedIds={visitedLocationIds}
              selectedPub={selectedPub}
              today={today}
              hasCrawl={crawl.crawl !== null}
              onPlan={crawl.start}
              onClose={crawl.closePlanner}
            />
          )}

          {crawl.isEndPending && (
            <ConfirmDialog
              title="End this crawl?"
              message="The route will be cleared. Visits you've logged on the way are kept."
              confirmLabel="End crawl"
              variant="danger"
              onConfirm={crawl.end}
              onCancel={crawl.cancelEnd}
            />
          )}

          {isHistoryOpen && selectedStats.count > 0 && (
            <VisitHistory
              pubName={selectedPub.name}
              visits={indexedVisits[selectedPub.id]}
              onAdd={() => {
                setIsHistoryOpen(false);
                editor.openAdd();
              }}
              onEdit={(visit) => {
                setIsHistoryOpen(false);
                editor.openEdit(visit);
              }}
              onDelete={setVisitPendingDelete}
              onClose={() => setIsHistoryOpen(false)}
            />
          )}

          {visitPendingDelete && (
            <ConfirmDialog
              title="Delete visit?"
              message={
                <>
                  Your visit to <strong>{selectedPub.name}</strong> on{' '}
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

          {editor.isOpen && (
            <VisitFormModal
              editor={editor}
              locations={locations}
              selectedId={selectedId}
              onSelectPub={select}
            />
          )}

          <div className="map-crawl-layout">
            <div
              className={`map-viewport-wrapper ${mapExpanded.isExpanded ? 'is-expanded' : ''}`}
              ref={mapRef}
            >
              <Map
                locations={filters.filteredLocations}
                visitedLocationIds={visitedLocationIds}
                selectedLocationId={selectedId}
                onLocationSelect={selectAnyPub}
                initialBounds={initialMapBounds}
                userPosition={nearMe.userPosition}
                expanded={mapExpanded.isExpanded}
                onToggleExpanded={mapExpanded.toggle}
                onNearMe={nearMe.nearMe}
                locating={nearMe.locating}
                locationError={nearMe.locationError}
                crawlRoute={crawl.route}
                routeFitKey={crawl.routeFitKey}
                livePosition={live.position}
              >
                <SelectedPubBar
                  pub={selectedPub}
                  visitCount={selectedStats.count}
                  date={selectedStats.date}
                  trail={trail}
                  onOpen={() => setIsCardViewerOpen(true)}
                />
              </Map>

              {/* Hidden on phones, where the bar above shows instead */}
              <SpoonCard
                id={selectedPub.id}
                name={selectedPub.name}
                city={selectedPub.city}
                region={selectedPub.region}
                rarity={selectedPub.rarity}
                rating={selectedStats.rating}
                history={selectedPub.history}
                visited={selectedStats.count > 0}
                visitCount={selectedStats.count}
                date={selectedStats.date}
                small={true}
                compact={true}
                hasImage={Boolean(selectedPub.imgType)}
                nearestMiles={selectedPub.nearestNeighborMiles}
                secondMiles={selectedPub.secondNeighborMiles}
                website={selectedPub.website}
                menu={selectedPub.menu}
                onClick={() => setIsCardViewerOpen(true)}
              />
              <div className="map-card-nav">
                <TrailNav trail={trail} variant="map" />
              </div>
            </div>

            {crawl.crawl && (
              <CrawlPanel
                crawl={crawl.crawl}
                pubsById={pubsById}
                indexedVisits={indexedVisits}
                onSelectPub={(pubId) => {
                  selectAnyPub(pubId);
                  scrollToMap();
                }}
                onCheckIn={checkInAt}
                onShowRoute={() => {
                  crawl.showRoute();
                  scrollToMap();
                }}
                onEnd={crawl.requestEnd}
                onFinish={crawl.end}
                isFocused={isCrawlMode}
                onBrowse={crawl.browse}
                onBackToCrawl={crawl.backToCrawl}
                unlockedNow={unlockedNow}
              />
            )}
          </div>

          {!isCrawlMode && (
            <VisitMetrics visitedCount={visitsApi.uniqueVisitedCount} totalCount={locations.length} />
          )}
        </div>

        {!isCrawlMode && (
          <Visits
            locations={filters.filteredLocations}
            regions={regions}
            indexedVisits={indexedVisits}
            onOpenCard={openCard}
            selectedLocationId={selectedId}
            searchTerm={filters.searchTerm}
            selectedRegion={filters.selectedRegion}
            visitFilter={filters.visitFilter}
            onSearchChange={filters.setSearchTerm}
            onRegionChange={filters.setSelectedRegion}
            onVisitFilterChange={filters.setVisitFilter}
            sortBy={filters.sortBy}
            onSortChange={filters.setSortBy}
            userPosition={nearMe.userPosition}
            onNearMe={nearMe.nearMe}
            locating={nearMe.locating}
            locationError={nearMe.locationError}
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
          <BackupPanel
            visits={visits}
            onVisitsChange={visitsApi.setVisits}
            crawl={crawl.crawl}
            prepareCrawl={(value) => sanitiseCrawl(value, locations)}
            onCrawlRestore={crawl.restore}
            backup={backup}
          />
        </section>
      )}
    </div>
  );
}

export default App;
