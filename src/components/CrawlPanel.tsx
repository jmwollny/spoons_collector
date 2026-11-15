import type { PubLocation, VisitEntry } from '../types';
import { formatArrival, formatDuration, formatTime, summariseCrawl, type Crawl } from '../crawl';
import { formatDate, formatMiles } from '../utils';
import { CrawlStopRow } from './crawl/CrawlStopRow';
import { CrawlCompleteSummary } from './crawl/CrawlCompleteSummary';
import './Crawl.css';

type CrawlPanelProps = {
  crawl: Crawl;
  pubsById: Map<number, PubLocation>;
  indexedVisits: Record<number, VisitEntry[]>;
  onSelectPub: (pubId: number) => void;
  onCheckIn: (pubId: number) => void;
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

/** The crawl under way: its stops in order, ticked off as they're visited */
export const CrawlPanel = ({
  crawl,
  pubsById,
  indexedVisits,
  onSelectPub,
  onCheckIn,
  onShowRoute,
  onEnd,
  onFinish,
  isFocused,
  onBrowse,
  onBackToCrawl,
  unlockedNow,
}: CrawlPanelProps) => {
  const summary = summariseCrawl(crawl, indexedVisits, unlockedNow);
  const stopCount = crawl.stops.length;

  return (
    <section className="crawl-panel" aria-label="Your Spoons crawl">
      <header className="crawl-panel-header">
        <div>
          <h2>Your Spoons crawl</h2>
          <p className="crawl-panel-summary">
            {formatDate(crawl.date)} · from {crawl.startLabel}
          </p>
          <p className="crawl-panel-summary">
            {stopCount} pubs · {formatMiles(summary.totalMiles)} {crawl.mode === 'walk' ? 'walk' : 'trip'}{' '}
            · {formatTime(summary.start)}–{formatArrival(summary.finish)} (
            {formatDuration(summary.durationMinutes)})
            {summary.newCount > 0 && ` · ${summary.newCount} new`}
          </p>
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
          {!summary.isComplete && (
            <button type="button" className="visit-form-close" onClick={onEnd}>
              End
            </button>
          )}
        </div>
      </header>

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
                onSelect={onSelectPub}
                onCheckIn={onCheckIn}
              />
            )
          );
        })}
      </ol>

      <p className="crawl-form-note">
        Distances are as the crow flies; times allow a bit extra for the real route. Checking in logs
        a visit.
        {summary.goesLate && ' Most Wetherspoons close between 11pm and 1am.'}
      </p>
    </section>
  );
};
