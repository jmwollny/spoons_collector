import type { PubLocation, VisitEntry } from '../types';
import {
  crawlWarnings,
  formatArrival,
  formatDuration,
  formatTime,
  isLate,
  isStopDone,
  type Crawl,
} from '../crawl';
import { formatDate, formatMiles } from '../utils';
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
  const totalMiles = crawl.stops.reduce((sum, stop) => sum + stop.legMiles, 0);
  const first = crawl.stops[0];
  const last = crawl.stops[crawl.stops.length - 1];
  const finish = last.arrive + crawl.stayMinutes;
  const newCount = crawl.stops.filter((stop) => stop.wasNew).length;
  const doneCount = crawl.stops.filter((stop) => isStopDone(crawl, stop.pubId, indexedVisits)).length;
  // The first stop not yet visited
  const nextPubId = crawl.stops.find((stop) => !isStopDone(crawl, stop.pubId, indexedVisits))?.pubId;
  const goesLate = crawl.stops.some((stop) => isLate(stop.arrive));
  const warnings = crawlWarnings(crawl);
  const isComplete = doneCount === crawl.stops.length;
  // What the crawl unlocked, when we know what was unlocked at the start
  const newAchievements = crawl.unlockedAtStart
    ? unlockedNow.filter((title) => !crawl.unlockedAtStart?.includes(title))
    : [];

  return (
    <section className="crawl-panel" aria-label="Your Spoons crawl">
      <header className="crawl-panel-header">
        <div>
          <h2>Your Spoons crawl</h2>
          <p className="crawl-panel-summary">
            {formatDate(crawl.date)} · from {crawl.startLabel}
          </p>
          <p className="crawl-panel-summary">
            {crawl.stops.length} pubs · {formatMiles(totalMiles)}{' '}
            {crawl.mode === 'walk' ? 'walk' : 'trip'} · {formatTime(first.arrive)}–{formatArrival(finish)} (
            {formatDuration(finish - first.arrive)})
            {newCount > 0 && ` · ${newCount} new`}
          </p>
        </div>
        <div className="crawl-panel-actions">
          {isFocused ? (
            <button type="button" className="visit-form-close" onClick={onBrowse}>
              Browse all pubs
            </button>
          ) : (
            <button
              type="button"
              className="visit-form-close crawl-back-button"
              onClick={onBackToCrawl}
            >
              Back to crawl
            </button>
          )}
          <button type="button" className="visit-form-close" onClick={onShowRoute}>
            Show route
          </button>
          {!isComplete && (
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
        aria-valuemax={crawl.stops.length}
        aria-valuenow={doneCount}
        aria-label="Pubs visited"
      >
        <div style={{ width: `${(doneCount / crawl.stops.length) * 100}%` }} />
      </div>

      {warnings.map((warning) => (
        <p key={warning} className="crawl-warning">
          ⚠️ {warning}
        </p>
      ))}

      {isComplete && (
        <div className="crawl-complete" role="status">
          <p className="crawl-complete-title">🎉 Crawl complete!</p>
          <dl className="crawl-complete-stats">
            <div>
              <dt>Pubs</dt>
              <dd>{crawl.stops.length}</dd>
            </div>
            <div>
              <dt>Distance</dt>
              <dd>{formatMiles(totalMiles)}</dd>
            </div>
            <div>
              <dt>New to you</dt>
              <dd>{newCount}</dd>
            </div>
          </dl>
          {newAchievements.length > 0 && (
            <p className="crawl-complete-achievements">
              🏅 Unlocked: <strong>{newAchievements.join(', ')}</strong>
            </p>
          )}
          <button type="button" className="crawl-finish-button" onClick={onFinish}>
            Finish crawl
          </button>
        </div>
      )}

      <ol className="crawl-stops">
        {crawl.stops.map((stop, index) => {
          const pub = pubsById.get(stop.pubId);
          if (!pub) return null;
          const done = isStopDone(crawl, stop.pubId, indexedVisits);
          const isNext = stop.pubId === nextPubId;
          return (
            <li
              key={stop.pubId}
              className={`crawl-stop-row ${done ? 'is-done' : ''} ${isNext ? 'is-next' : ''}`}
            >
              <span className={`crawl-stop-number rarity-${pub.rarity.toLowerCase()}`} aria-hidden="true">
                {done ? '✓' : index + 1}
              </span>
              <button type="button" className="crawl-stop-main" onClick={() => onSelectPub(pub.id)}>
                <span className="crawl-stop-name">{pub.name}</span>
                <span className="crawl-stop-meta">
                  {pub.city} · {pub.rarity}
                  {stop.wasNew && ' · new'}
                </span>
                <span className="crawl-stop-meta">
                  {index === 0 && crawl.startIsPub
                    ? 'Start here'
                    : `${formatMiles(stop.legMiles)} from ${index === 0 ? 'start' : 'last stop'}`}{' '}
                  · arrive ~{formatArrival(stop.arrive)}
                  {isLate(stop.arrive) && ' (late: check it\'s open)'}
                </span>
              </button>
              {stop.meal && <span className="crawl-meal">{stop.meal}</span>}
              {!done && (
                <button
                  type="button"
                  className={`crawl-check-in ${isNext ? 'is-next' : ''}`}
                  onClick={() => onCheckIn(pub.id)}
                >
                  Check in
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <p className="crawl-form-note">
        Distances are as the crow flies; times allow a bit extra for the real
        route. Checking in logs a visit.
        {goesLate && ' Most Wetherspoons close between 11pm and 1am.'}
      </p>
    </section>
  );
};
