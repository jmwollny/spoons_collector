import { useEffect, useMemo, useState } from 'react';
import type { PubLocation, VisitEntry } from '../types';
import type { CrawlRoute } from '../components/Map';
import { isStopDone, loadCrawl, saveCrawl, type Crawl } from '../crawl';

type CrawlSessionOptions = {
  locations: PubLocation[];
  pubsById: Map<number, PubLocation>;
  indexedVisits: Record<number, VisitEntry[]>;
  // Achievements unlocked now, recorded when a crawl starts for its summary
  unlockedNow: string[];
  // Called when a crawl starts, and when the user returns to it from
  // browsing, with the pub the map should show
  onEnterCrawl: (pubId: number, how: 'started' | 'returned') => void;
};

/**
 * The Spoons crawl under way: planning, crawl mode, the route on the map,
 * ending and finishing. Saved, so it survives the app closing.
 */
export const useCrawlSession = ({
  locations,
  pubsById,
  indexedVisits,
  unlockedNow,
  onEnterCrawl,
}: CrawlSessionOptions) => {
  const [crawl, setCrawl] = useState<Crawl | null>(() => loadCrawl(locations));
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [isEndPending, setIsEndPending] = useState(false);
  // During a crawl the page shows only the map and the crawl ("crawl
  // mode"), unless the user chose to browse all the pubs meanwhile
  const [isBrowsing, setIsBrowsing] = useState(false);
  // Bumped to make the map zoom to the whole crawl; starts at 1 so a crawl
  // under way is in view when the app opens
  const [routeFitKey, setRouteFitKey] = useState(() => (crawl ? 1 : 0));

  useEffect(() => {
    saveCrawl(crawl);
  }, [crawl]);

  const isCrawlMode = crawl !== null && !isBrowsing;

  const isDone = (pubId: number) => (crawl ? isStopDone(crawl, pubId, indexedVisits) : false);

  const doneStopIds = useMemo(
    () =>
      new Set(
        crawl?.stops
          .filter((stop) => isStopDone(crawl, stop.pubId, indexedVisits))
          .map((stop) => stop.pubId) ?? [],
      ),
    [crawl, indexedVisits],
  );

  const route = useMemo<CrawlRoute | null>(() => {
    if (!crawl) return null;
    return {
      start: crawl.startIsPub
        ? null
        : { lat: crawl.startLat, lon: crawl.startLon, label: crawl.startLabel },
      stops: crawl.stops.flatMap((stop) => {
        const pub = pubsById.get(stop.pubId);
        return pub
          ? [{ pubId: pub.id, lat: pub.lat, lon: pub.lon, name: pub.name, done: doneStopIds.has(pub.id) }]
          : [];
      }),
    };
  }, [crawl, pubsById, doneStopIds]);

  const showRoute = () => setRouteFitKey((key) => key + 1);

  const start = (planned: Crawl) => {
    setCrawl({ ...planned, unlockedAtStart: unlockedNow });
    setIsPlannerOpen(false);
    setIsBrowsing(false);
    showRoute();
    onEnterCrawl(planned.stops[0].pubId, 'started');
  };

  /** Clears the crawl; visits logged on it are kept */
  const end = () => {
    setCrawl(null);
    setIsBrowsing(false);
    setIsEndPending(false);
  };

  /**
   * Leaves browsing for crawl mode, showing the next stop not yet checked
   * in at (the last stop if they all are)
   */
  const backToCrawl = () => {
    if (!crawl) return;
    const nextStop =
      crawl.stops.find((stop) => !doneStopIds.has(stop.pubId)) ?? crawl.stops[crawl.stops.length - 1];
    setIsBrowsing(false);
    onEnterCrawl(nextStop.pubId, 'returned');
  };

  /** A crawl from a backup file */
  const restore = (restored: Crawl) => {
    setCrawl(restored);
    showRoute();
  };

  return {
    crawl,
    isCrawlMode,
    route,
    routeFitKey,
    doneStopIds,
    isDone,
    isPlannerOpen,
    openPlanner: () => setIsPlannerOpen(true),
    closePlanner: () => setIsPlannerOpen(false),
    start,
    isEndPending,
    requestEnd: () => setIsEndPending(true),
    cancelEnd: () => setIsEndPending(false),
    end,
    browse: () => setIsBrowsing(true),
    backToCrawl,
    showRoute,
    restore,
  };
};

export type CrawlSession = ReturnType<typeof useCrawlSession>;
