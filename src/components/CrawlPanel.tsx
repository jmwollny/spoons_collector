import { useState } from 'react';
import type { PubLocation, VisitEntry } from '../types';
import { formatArrival, formatDuration, formatTime, summariseCrawl, type Crawl } from '../crawl';
import { crawlScore, stopPoints } from '../crawlScore';
import { crawlShareText } from '../crawlShare';
import { shareText } from '../files';
import type { StreetRouteStatus } from '../hooks/useCrawlSession';
import { formatDate, formatMiles } from '../utils';
import { CrawlStopRow } from './crawl/CrawlStopRow';
import { CrawlCompleteSummary } from './crawl/CrawlCompleteSummary';
import './Crawl.css';

type CrawlPanelProps = {
  crawl: Crawl;
  pubsById: Map<number, PubLocation>;
  indexedVisits: Record<number, VisitEntry[]>;
  // On a treasure hunt, the stops still hidden behind their clues
  hiddenIds: Set<number>;
  // Whether the route along the streets is being fetched, or failed
  streetRouteStatus: StreetRouteStatus;
  onSelectPub: (pubId: number) => void;
  onCheckIn: (pubId: number) => void;
  onReveal: (pubId: number) => void;
  onShowRoute: () => void;
  // Ends the crawl, asking first
  onEnd: () => void;
  // Ends a finished crawl, without asking
  onFinish: () => void;
  // Whether the page shows only the crawl (crawl mode), or everything
  isFocused: boolean;
  // Switch between crawl mode and the normal page, keeping the crawl
  onBrowse: () => void;
  onBackToCrawl: () => void;
  // Titles of the achievements unlocked now
  unlockedNow: string[];
};

const ROUTE_NOTES: Record<StreetRouteStatus, React.ReactNode> = {
  none: 'Distances are as the crow flies; times allow a bit extra for the real route.',
  loading: 'Finding the route along the streets…',
  // The routing service asks for attribution and a "fix the map" link
  done: (
    <>
      Distances and times follow the streets (routes from{' '}
      <a href="https://routing.openstreetmap.de/" target="_blank" rel="noopener noreferrer">
        routing.openstreetmap.de
      </a>
      , map data © OpenStreetMap contributors;{' '}
      <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">
        fix the map
      </a>
      ).
    </>
  ),
  failed: "Couldn't get the route along the streets, so distances are as the crow flies.",
};

/** The crawl under way: its stops in order, ticked off as they're visited */
export const CrawlPanel = ({
  crawl,
  pubsById,
  indexedVisits,
  hiddenIds,
  streetRouteStatus,
  onSelectPub,
  onCheckIn,
  onReveal,
  onShowRoute,
  onEnd,
  onFinish,
  isFocused,
  onBrowse,
  onBackToCrawl,
  unlockedNow,
}: CrawlPanelProps) => {
  const summary = summariseCrawl(crawl, indexedVisits, unlockedNow);
  const score = crawlScore(crawl, summary.doneIds, pubsById);
  const stopCount = crawl.stops.length;
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const share = async () => {
    setShareStatus(null);
    try {
      const result = await shareText(crawlShareText(crawl), 'Join my Spoons crawl');
      if (result === 'copied') setShareStatus('Copied the invitation: paste it to your friends.');
    } catch (error) {
      setShareStatus(`Couldn't share: ${error instanceof Error ? error.message : error}`);
    }
  };

  return (
    <section className="crawl-panel" aria-label="Your Spoons crawl">
      <header className="crawl-panel-header">
        <div>
          <h2>{crawl.treasureHunt ? 'Your Spoons treasure hunt' : 'Your Spoons crawl'}</h2>
          <p className="crawl-panel-summary">
            {formatDate(crawl.date)} · from {crawl.startLabel}
          </p>
          <p className="crawl-panel-summary">
            {stopCount} pubs · {formatMiles(summary.totalMiles)} {crawl.mode === 'walk' ? 'walk' : 'trip'}{' '}
            · {formatTime(summary.start)}–{formatArrival(summary.finish)} (
            {formatDuration(summary.durationMinutes)})
            {summary.newCount > 0 && ` · ${summary.newCount} new`}
          </p>
          <p className="crawl-score">Score: {score}</p>
        </div>
        <div className="crawl-panel-actions">
          {isFocused ? (
            <button type="button" className="visit-form-close" onClick={onBrowse}>
              Browse all pubs
            </button>
          ) : (
            <button type="button" className="visit-form-close crawl-back-button" onClick={onBackToCrawl}>
              Back to crawl
            </button>
          )}
          <button type="button" className="visit-form-close" onClick={onShowRoute}>
            Show route
          </button>
          <button type="button" className="visit-form-close" onClick={share}>
            Share
          </button>
          {!summary.isComplete && (
            <button type="button" className="visit-form-close" onClick={onEnd}>
              End
            </button>
          )}
        </div>
      </header>

      {shareStatus && (
        <p className="crawl-share-status" role="status">
          {shareStatus}
        </p>
      )}

      <div
        className="crawl-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={stopCount}
        aria-valuenow={summary.doneCount}
        aria-label="Pubs visited"
      >
        <div style={{ width: `${(summary.doneCount / stopCount) * 100}%` }} />
      </div>

      {summary.warnings.map((warning) => (
        <p key={warning} className="crawl-warning">
          ⚠️ {warning}
        </p>
      ))}

      {summary.isComplete && (
        <CrawlCompleteSummary
          pubCount={stopCount}
          totalMiles={summary.totalMiles}
          newCount={summary.newCount}
          score={score}
          newAchievements={summary.newAchievements}
          onFinish={onFinish}
        />
      )}

      <ol className="crawl-stops">
        {crawl.stops.map((stop, index) => {
          const pub = pubsById.get(stop.pubId);
          return (
            pub && (
              <CrawlStopRow
                key={stop.pubId}
                stop={stop}
                pub={pub}
                index={index}
                isStartPub={index === 0 && crawl.startIsPub}
                isDone={summary.doneIds.has(stop.pubId)}
                isNext={stop.pubId === summary.nextPubId}
                isHidden={hiddenIds.has(stop.pubId)}
                points={stopPoints(crawl, index, pubsById)}
                onSelect={onSelectPub}
                onCheckIn={onCheckIn}
                onReveal={onReveal}
              />
            )
          );
        })}
      </ol>

      <p className="crawl-form-note">
        {ROUTE_NOTES[streetRouteStatus]} Checking in logs a visit.
        {crawl.treasureHunt && ' Found stops score half as much again; revealed ones don’t.'}
        {summary.goesLate && ' Most Wetherspoons close between 11pm and 1am.'}
      </p>
    </section>
  );
};
