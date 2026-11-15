import { useEffect, useMemo, useState } from 'react';
import type { PubLocation, VisitEntry } from '../types';
import type { CrawlRoute } from '../components/Map';
import { isStopDone, loadCrawl, saveCrawl, type Crawl } from '../crawl';
import {
  completedCrawl,
  loadCrawlHistory,
  mergeCrawlHistory,
  saveCrawlHistory,
  type CompletedCrawl,
} from '../crawlScore';
import { hiddenStopIds } from '../treasure';
import { applyStreetRoute, fetchStreetRoute } from '../streetRoute';

type CrawlSessionOptions = {
  locations: PubLocation[];
  pubsById: Map<number, PubLocation>;
  indexedVisits: Record<number, VisitEntry[]>;
  // Called when a crawl starts, and when the user returns to it from
  // browsing, with the pub the map should show (null if it's a hidden
  // treasure-hunt stop, which showing would give away)
  onEnterCrawl: (pubId: number | null, how: 'started' | 'returned') => void;
};

export type StreetRouteStatus = 'none' | 'loading' | 'done' | 'failed';

/**
 * The Spoons crawl under way: planning, crawl mode, the route on the map,
 * treasure-hunt clues, ending and finishing, and the crawls finished
 * before. Saved, so it survives the app closing.
 */
export const useCrawlSession = ({
  locations,
  pubsById,
  indexedVisits,
  onEnterCrawl,
}: CrawlSessionOptions) => {
  const [crawl, setCrawl] = useState<Crawl | null>(() => loadCrawl(locations));
  const [history, setHistory] = useState<CompletedCrawl[]>(loadCrawlHistory);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [isEndPending, setIsEndPending] = useState(false);
  // During a crawl the page shows only the map and the crawl ("crawl
  // mode"), unless the user chose to browse all the pubs meanwhile
  const [isBrowsing, setIsBrowsing] = useState(false);
  // Bumped to make the map zoom to the whole crawl; starts at 1 so a crawl
  // under way is in view when the app opens
  const [routeFitKey, setRouteFitKey] = useState(() => (crawl ? 1 : 0));
  // The crawl whose street route failed, so it isn't asked for again
  const [routeFailedFor, setRouteFailedFor] = useState<string | null>(null);

  useEffect(() => {
    saveCrawl(crawl);
  }, [crawl]);

  useEffect(() => {
    saveCrawlHistory(history);
  }, [history]);

  // Fetch the route along the streets, between the pubs only (never from
  // the user's own location), for crawls planned to follow streets
  const needsStreetRoute =
    crawl !== null &&
    crawl.followStreets === true &&
    !crawl.streetPath &&
    crawl.stops.length >= 2 &&
    routeFailedFor !== crawl.id;
  const crawlId = crawl?.id;
  useEffect(() => {
    if (!needsStreetRoute || !crawl) return;
    let cancelled = false;
    const points = crawl.stops.flatMap((stop) => {
      const pub = pubsById.get(stop.pubId);
      return pub ? [{ lat: pub.lat, lon: pub.lon }] : [];
    });
    fetchStreetRoute(points, crawl.mode)
      .then((route) => {
        if (cancelled) return;
        setCrawl((current) => (current?.id === crawl.id ? applyStreetRoute(current, route) : current));
      })
      .catch(() => {
        if (!cancelled) setRouteFailedFor(crawl.id);
      });
    return () => {
      cancelled = true;
    };
    // Once per crawl; the crawl changing as stops are ticked off doesn't matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsStreetRoute, crawlId]);

  const streetRouteStatus: StreetRouteStatus = !crawl?.followStreets
    ? 'none'
    : crawl.streetPath
      ? 'done'
      : routeFailedFor === crawl.id
        ? 'failed'
        : 'loading';

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

  // On a treasure hunt, the stops still hidden behind their clues
  const hiddenIds = useMemo(
    () => (crawl ? hiddenStopIds(crawl, doneStopIds) : new Set<number>()),
    [crawl, doneStopIds],
  );

  const isComplete = crawl !== null && doneStopIds.size === crawl.stops.length;

  /** The crawl as a finished crawl, once every stop is visited */
  const currentAsCompleted = useMemo(
    () => (crawl && isComplete ? completedCrawl(crawl, doneStopIds, pubsById) : null),
    [crawl, isComplete, doneStopIds, pubsById],
  );

  const route = useMemo<CrawlRoute | null>(() => {
    if (!crawl) return null;
    return {
      start: crawl.startIsPub ? null : { lat: crawl.startLat, lon: crawl.startLon, label: crawl.startLabel },
      stops: crawl.stops.flatMap((stop, index) => {
        const pub = pubsById.get(stop.pubId);
        // Hidden treasure-hunt stops stay off the map
        return pub && !hiddenIds.has(pub.id)
          ? [{ pubId: pub.id, number: index + 1, lat: pub.lat, lon: pub.lon, name: pub.name, done: doneStopIds.has(pub.id) }]
          : [];
      }),
      // The street route would give hidden stops away
      streetPath: hiddenIds.size === 0 ? crawl.streetPath ?? null : null,
    };
  }, [crawl, pubsById, doneStopIds, hiddenIds]);

  const showRoute = () => setRouteFitKey((key) => key + 1);

  /**
   * Starts a crawl, noting the achievements already unlocked so its summary
   * can show what it unlocked
   */
  const start = (planned: Crawl, unlockedAtStart: string[]) => {
    setCrawl({ ...planned, unlockedAtStart });
    setIsPlannerOpen(false);
    setIsBrowsing(false);
    showRoute();
    // On a treasure hunt the first stop is hidden, unless the crawl starts there
    const firstIsHidden = planned.treasureHunt && !planned.startIsPub;
    onEnterCrawl(firstIsHidden ? null : planned.stops[0].pubId, 'started');
  };

  /** Clears the crawl; visits logged on it are kept */
  const end = () => {
    setCrawl(null);
    setIsBrowsing(false);
    setIsEndPending(false);
  };

  /** Ends a completed crawl, keeping it in the history for achievements */
  const finish = () => {
    if (currentAsCompleted) {
      setHistory((current) => mergeCrawlHistory(current, [currentAsCompleted]));
    }
    end();
  };

  /** Gives up on a treasure-hunt clue and shows the pub */
  const reveal = (pubId: number) =>
    setCrawl((current) =>
      current && !current.revealed?.includes(pubId)
        ? { ...current, revealed: [...(current.revealed ?? []), pubId] }
        : current,
    );

  /**
   * Leaves browsing for crawl mode, showing the next stop not yet checked
   * in at (the last stop if they all are)
   */
  const backToCrawl = () => {
    if (!crawl) return;
    const nextStop =
      crawl.stops.find((stop) => !doneStopIds.has(stop.pubId)) ?? crawl.stops[crawl.stops.length - 1];
    setIsBrowsing(false);
    // A hidden stop isn't shown on the map
    onEnterCrawl(hiddenIds.has(nextStop.pubId) ? null : nextStop.pubId, 'returned');
  };

  /** A crawl from a backup file */
  const restore = (restored: Crawl) => {
    setCrawl(restored);
    showRoute();
  };

  return {
    crawl,
    history,
    // The history, with the crawl under way if it's complete, for
    // achievements unlocked by finishing it
    historyWithCurrent: currentAsCompleted ? mergeCrawlHistory(history, [currentAsCompleted]) : history,
    restoreHistory: (crawls: CompletedCrawl[]) => setHistory((current) => mergeCrawlHistory(current, crawls)),
    isCrawlMode,
    route,
    routeFitKey,
    streetRouteStatus,
    doneStopIds,
    hiddenIds,
    isDone,
    isComplete,
    isPlannerOpen,
    openPlanner: () => setIsPlannerOpen(true),
    closePlanner: () => setIsPlannerOpen(false),
    start,
    isEndPending,
    requestEnd: () => setIsEndPending(true),
    cancelEnd: () => setIsEndPending(false),
    end,
    finish,
    reveal,
    browse: () => setIsBrowsing(true),
    backToCrawl,
    showRoute,
    restore,
  };
};

export type CrawlSession = ReturnType<typeof useCrawlSession>;
