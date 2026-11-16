import type { PubLocation } from '../../types';
import { formatArrival, isLate, type CrawlStop } from '../../crawl';
import { makeClue } from '../../treasure';
import { usePubHistory } from '../../pubHistory';
import { formatMiles } from '../../utils';

type CrawlStopRowProps = {
  stop: CrawlStop;
  pub: PubLocation;
  // Position on the crawl, from 0
  index: number;
  // Whether the crawl starts at this, its first pub
  isStartPub: boolean;
  isDone: boolean;
  // The first stop not yet visited
  isNext: boolean;
  // On a treasure hunt: still hidden behind its clue
  isHidden: boolean;
  // Points for this stop (earned once it's visited)
  points: number;
  onSelect: (pubId: number) => void;
  onCheckIn: (pubId: number) => void;
  onReveal: (pubId: number) => void;
};

/**
 * One stop on a crawl: number, pub, distance, arrival time, meal and Check
 * in. On a treasure hunt, a stop not yet found shows a clue instead of the
 * pub, with Reveal for when the user gives up.
 */
export const CrawlStopRow = ({
  stop,
  pub,
  index,
  isStartPub,
  isDone,
  isNext,
  isHidden,
  points,
  onSelect,
  onCheckIn,
  onReveal,
}: CrawlStopRowProps) => {
  // A shareable build loads the history for the clue (and keeps it, so the
  // clue still works offline once the hunt is under way)
  const history = usePubHistory(pub, isHidden);
  const distance = isStartPub
    ? 'Start here'
    : `${formatMiles(stop.legMiles)} from ${index === 0 ? 'start' : 'last stop'}`;
  const timing = (
    <>
      {distance} · arrive ~{formatArrival(stop.arrive)}
      {isLate(stop.arrive) && " (late: check it's open)"}
    </>
  );

  return (
    <li className={`crawl-stop-row ${isDone ? 'is-done' : ''} ${isNext ? 'is-next' : ''} ${isHidden ? 'is-hidden' : ''}`}>
      <span className={`crawl-stop-number rarity-${pub.rarity.toLowerCase()}`} aria-hidden="true">
        {isDone ? '✓' : index + 1}
      </span>
      {isHidden ? (
        <div className="crawl-stop-main">
          <span className="crawl-stop-name">Mystery stop</span>
          <span className="crawl-stop-meta">
            {pub.rarity} · {timing}
          </span>
          <q className="crawl-clue">{makeClue({ ...pub, history: history.text })}</q>
        </div>
      ) : (
        <button type="button" className="crawl-stop-main" onClick={() => onSelect(pub.id)}>
          <span className="crawl-stop-name">{pub.name}</span>
          <span className="crawl-stop-meta">
            {pub.city} · {pub.rarity}
            {stop.wasNew && ' · new'}
          </span>
          <span className="crawl-stop-meta">{timing}</span>
        </button>
      )}
      {stop.meal && <span className="crawl-meal">{stop.meal}</span>}
      <span className={`crawl-points ${isDone ? 'is-earned' : ''}`} title={isDone ? 'Points earned' : 'Points to earn'}>
        {points} pts
      </span>
      {isHidden && (
        <button type="button" className="crawl-reveal" onClick={() => onReveal(pub.id)}>
          Reveal
        </button>
      )}
      {!isDone && (
        <button
          type="button"
          className={`crawl-check-in ${isNext ? 'is-next' : ''}`}
          onClick={() => onCheckIn(pub.id)}
        >
          {isHidden ? "I'm here" : 'Check in'}
        </button>
      )}
    </li>
  );
};
