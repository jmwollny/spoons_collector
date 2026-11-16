import { useLayoutEffect, useRef, useState } from 'react';
import type { PubLocation, VisitEntry } from '../types';
import type { CompletedCrawl } from '../crawlScore';
import { Achievements } from './Achievements';
import { RarityProgress } from './RarityProgress';
import { RegionBreakdown } from './RegionBreakdown';
import { StatsPanel } from './StatsPanel';

type ProgressSectionProps = {
  locations: PubLocation[];
  pubsById: Map<number, PubLocation>;
  today: string;
  visits: VisitEntry[];
  visitedLocationIds: Set<number>;
  indexedVisits: Record<number, VisitEntry[]>;
  // Crawls finished, for the crawl achievements
  crawlHistory?: CompletedCrawl[];
};

// The cards are never shorter than this, even when the stats card is
// (e.g. before any visits)
export const MIN_CARD_HEIGHT = 420;

/**
 * The height of the Your stats card, kept up to date as it changes, so the
 * other cards can match it
 */
const useStatsCardHeight = () => {
  const section = useRef<HTMLElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const stats = section.current?.querySelector<HTMLElement>('.stats-panel');
    if (!stats) return;
    const measure = () => setHeight(stats.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stats);
    return () => observer.disconnect();
  }, []);
  return { section, height: Math.max(height, MIN_CARD_HEIGHT) };
};

/**
 * The cards under the map and list: stats, achievements and progress. On
 * wide screens every card is as tall as the stats card, and taller ones
 * (Achievements, Regions) scroll inside themselves.
 */
export const ProgressSection = ({
  locations,
  pubsById,
  today,
  visits,
  visitedLocationIds,
  indexedVisits,
  crawlHistory = [],
}: ProgressSectionProps) => {
  const stats = useStatsCardHeight();
  return (
    <section
      className="progress-grid"
      ref={stats.section}
      style={{ '--progress-card-height': `${stats.height}px` } as React.CSSProperties}
    >
      <StatsPanel visits={visits} pubsById={pubsById} today={today} />
      <Achievements
        locations={locations}
        visitedLocationIds={visitedLocationIds}
        indexedVisits={indexedVisits}
        crawls={crawlHistory}
      />
      <RarityProgress locations={locations} visitedLocationIds={visitedLocationIds} />
      <RegionBreakdown locations={locations} visitedLocationIds={visitedLocationIds} />
    </section>
  );
};
