import type { PubLocation } from '../../types';
import { formatArrival, isLate, type CrawlStop } from '../../crawl';
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
  onSelect: (pubId: number) => void;
  onCheckIn: (pubId: number) => void;
};

/** One stop on a crawl: number, pub, distance, arrival time, meal and Check in */
export const CrawlStopRow = ({
  stop,
  pub,
  index,
  isStartPub,
  isDone,
  isNext,
  onSelect,
  onCheckIn,
}: CrawlStopRowProps) => (
  <li className={`crawl-stop-row ${isDone ? 'is-done' : ''} ${isNext ? 'is-next' : ''}`}>
    <span className={`crawl-stop-number rarity-${pub.rarity.toLowerCase()}`} aria-hidden="true">
      {isDone ? '✓' : index + 1}
    </span>
    <button type="button" className="crawl-stop-main" onClick={() => onSelect(pub.id)}>
      <span className="crawl-stop-name">{pub.name}</span>
      <span className="crawl-stop-meta">
        {pub.city} · {pub.rarity}
        {stop.wasNew && ' · new'}
      </span>
      <span className="crawl-stop-meta">
        {isStartPub
          ? 'Start here'
          : `${formatMiles(stop.legMiles)} from ${index === 0 ? 'start' : 'last stop'}`}{' '}
        · arrive ~{formatArrival(stop.arrive)}
        {isLate(stop.arrive) && " (late: check it's open)"}
      </span>
    </button>
    {stop.meal && <span className="crawl-meal">{stop.meal}</span>}
    {!isDone && (
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
