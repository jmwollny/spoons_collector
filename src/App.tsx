import { useCallback, useMemo, useRef, useState } from 'react';
import './App.css';
import type { VisitEntry } from './types';
import type { PubData } from './data';
import { distanceMiles, formatDate, plural, todayDate } from './utils';
import { sanitiseCrawl, type Crawl } from './crawl';
import { decodeCrawl } from './crawlShare';
import { useIncomingCrawl } from './hooks/useIncomingCrawl';
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
import { Visits } from './components/Visits';
import { ConfirmDialog } from './components/ConfirmDialog';
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
import { MapPubCard } from './components/MapPubCard';
import { AppMenu } from './components/AppMenu';
import { ProgressSection } from './components/ProgressSection';
import { PubFilters } from './components/PubFilters';
import { TabBar } from './components/TabBar';
import { useAppView } from './hooks/useAppView';

function App({ data }: { data: PubData }) {
  const { locations, pubsById, regions, initialMapBounds } = data;
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
  // Phones show the map, the cards or the stats, chosen with the tab bar
  const appView = useAppView();

  // Brings the map into view: on a phone by switching to the Map tab, and
  // otherwise by scrolling. Scrolls once the page has updated, as what's
  // shown above the map can change at the same moment (e.g. starting a
  // crawl hides the backup reminder), which would leave the scroll short
  // or overshooting.
  const scrollToMap = (block: ScrollLogicalPosition = 'start') => {
    if (appView.isTabbed) appView.choose('map');
    if (!mapExpanded.isExpanded) {
      requestAnimationFrame(() => mapRef.current?.scrollIntoView({ behavior: 'smooth', block }));
    }
  };

  // ---- Crawls ----
  const crawl = useCrawlSession({
    locations,
    pubsById,
    indexedVisits,
    // Crawl mode hides the list, so clear its search and filters, which
    // would otherwise hide pubs on the map with no visible reason
    onEnterCrawl: (pubId, how) => {
      filters.clearFilters();
      if (pubId !== null) select(pubId);
      if (how === 'started') {
        scrollToMap();
      } else {
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      }
    },
  });

  // Achievements unlocked, counting a crawl that's just been completed
  const { historyWithCurrent } = crawl;
  const unlockedNow = useMemo(
    () => unlockedTitles(locations, visitedLocationIds, indexedVisits, historyWithCurrent),
    [locations, visitedLocationIds, indexedVisits, historyWithCurrent],
  );
  const startCrawl = (planned: Crawl) =>
    crawl.start(planned, unlockedTitles(locations, visitedLocationIds, indexedVisits, crawl.history));

  // A crawl shared by a friend, arriving through a link
  const incoming = useIncomingCrawl();
  const incomingCrawl = useMemo(() => {
    if (!incoming.code) return null;
    try {
      return { crawl: { ...decodeCrawl(incoming.code, locations, visitedLocationIds), followStreets: true }, error: null };
    } catch (error) {
      return { crawl: null, error: error instanceof Error ? error.message : String(error) };
    }
    // Decoded once per code
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming.code]);

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

  const backup = useBackup(visits, crawl.crawl, today, crawl.history);

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
  // Crawl mode shows only the map and the crawl, so has no tabs
  const isTabbed = appView.isTabbed && !isCrawlMode;
  const showsView = (view: typeof appView.view) => !isTabbed || appView.view === view;

  return (
    <div
      className={`app-shell ${isCrawlMode ? 'is-crawl-mode' : ''} ${isTabbed ? `is-tabbed view-${appView.view}` : ''}`}
    >
      <header className="hero-card">
        <div>
          <h1>Spoons Collector</h1>
          <p className="hero-copy">Log your visits and rate each pub.</p>
        </div>
        <AppMenu
          visits={visits}
          onVisitsChange={visitsApi.setVisits}
          crawl={crawl.crawl}
          prepareCrawl={(value) => sanitiseCrawl(value, locations)}
          onCrawlRestore={crawl.restore}
          backup={backup}
          crawlHistory={crawl.history}
          onCrawlHistoryRestore={crawl.restoreHistory}
          isLiveLocationOn={live.isOn}
          onToggleLiveLocation={live.toggle}
        />
      </header>

      {backup.isReminderDue && !isCrawlMode && (
        <BackupReminder backup={backup} visitCount={visits.length} today={today} />
      )}

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

      {/* The search and filters choose the pubs on both the map and the cards */}
      {!isCrawlMode && (!isTabbed || appView.view !== 'stats') && (
        <PubFilters
          count={filters.filteredLocations.length}
          searchTerm={filters.searchTerm}
          onSearchChange={filters.setSearchTerm}
          regions={regions}
          selectedRegion={filters.selectedRegion}
          onRegionChange={filters.setSelectedRegion}
          visitFilter={filters.visitFilter}
          onVisitFilterChange={filters.chooseVisitFilter}
          onNearMe={nearMe.nearMe}
          locating={nearMe.locating}
          locationError={nearMe.locationError}
        />
      )}

      <section className="dashboard-split">
        {/* Hidden rather than removed on the other tabs, so the map keeps
            its place and zoom */}
        <div className="card map-card" hidden={!showsView('map')}>
          <MapToolbar
            onAddVisit={editor.openAdd}
            visitCount={selectedStats.count}
            onShowVisits={() => setIsHistoryOpen(true)}
            onPlanCrawl={crawl.openPlanner}
            canPlanCrawl={!isCrawlMode}
          >
            <SelectedPubSummary pub={selectedPub} visits={indexedVisits[selectedPub.id] ?? []} />
          </MapToolbar>

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

              <MapPubCard
                pub={selectedPub}
                stats={selectedStats}
                trail={trail}
                onOpen={() => setIsCardViewerOpen(true)}
              />
            </div>

            {crawl.crawl && (
              <CrawlPanel
                crawl={crawl.crawl}
                pubsById={pubsById}
                indexedVisits={indexedVisits}
                hiddenIds={crawl.hiddenIds}
                streetRouteStatus={crawl.streetRouteStatus}
                onReveal={crawl.reveal}
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
                onFinish={crawl.finish}
                isFocused={isCrawlMode}
                onBrowse={crawl.browse}
                onBackToCrawl={crawl.backToCrawl}
                unlockedNow={unlockedNow}
              />
            )}
          </div>

          {!isCrawlMode && !isTabbed && (
            <VisitMetrics visitedCount={visitsApi.uniqueVisitedCount} totalCount={locations.length} />
          )}
        </div>

        {!isCrawlMode && showsView('cards') && (
          <Visits
            locations={filters.filteredLocations}
            indexedVisits={indexedVisits}
            onOpenCard={openCard}
            selectedLocationId={selectedId}
            sortBy={filters.sortBy}
            onSortChange={filters.setSortBy}
            filterKey={`${filters.searchTerm}|${filters.selectedRegion}|${filters.visitFilter}`}
            userPosition={nearMe.userPosition}
          />
        )}
      </section>

      {!isCrawlMode && showsView('stats') && (
        <>
          {isTabbed && <VisitMetrics visitedCount={visitsApi.uniqueVisitedCount} totalCount={locations.length} />}
          <ProgressSection
            locations={locations}
            pubsById={pubsById}
            today={today}
            visits={visits}
            visitedLocationIds={visitedLocationIds}
            indexedVisits={indexedVisits}
            crawlHistory={crawl.history}
          />
        </>
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
          onPlan={startCrawl}
          onClose={crawl.closePlanner}
        />
      )}

      {incomingCrawl?.crawl && (
        <ConfirmDialog
          title={incomingCrawl.crawl.treasureHunt ? 'Join this treasure hunt?' : 'Join this crawl?'}
          message={
            <>
              {plural(incomingCrawl.crawl.stops.length, 'pub')} from {incomingCrawl.crawl.startLabel} on{' '}
              {formatDate(incomingCrawl.crawl.date)}.
              {crawl.crawl && ' It replaces the crawl you have under way.'}
            </>
          }
          confirmLabel="Join crawl"
          onConfirm={() => {
            startCrawl(incomingCrawl.crawl);
            incoming.clear();
          }}
          onCancel={incoming.clear}
        />
      )}

      {incomingCrawl?.error && (
        <ConfirmDialog
          title="Couldn't open that crawl"
          message={incomingCrawl.error}
          confirmLabel="OK"
          onConfirm={incoming.clear}
          onCancel={incoming.clear}
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

      {isTabbed && <TabBar view={appView.view} onChange={appView.choose} />}
    </div>
  );
}

export default App;
