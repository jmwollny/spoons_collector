import type { PubLocation, VisitEntry } from '../types';
import type { BackupControls } from '../backupReminder';
import type { Crawl } from '../crawl';
import type { CompletedCrawl } from '../crawlScore';
import { Achievements } from './Achievements';
import { RarityProgress } from './RarityProgress';
import { RegionBreakdown } from './RegionBreakdown';
import { BackupPanel } from './BackupPanel';
import { StatsPanel } from './StatsPanel';

type ProgressSectionProps = {
  locations: PubLocation[];
  pubsById: Map<number, PubLocation>;
  today: string;
  visits: VisitEntry[];
  visitedLocationIds: Set<number>;
  indexedVisits: Record<number, VisitEntry[]>;
  onVisitsChange: (visits: VisitEntry[]) => void;
  crawl: Crawl | null;
  prepareCrawl: (value: unknown) => Crawl | null;
  onCrawlRestore: (crawl: Crawl) => void;
  backup: BackupControls;
  // Crawls finished, for achievements and backups
  crawlHistory?: CompletedCrawl[];
  onCrawlHistoryRestore?: (crawls: CompletedCrawl[]) => void;
};

/** The cards under the map and list: stats, achievements, progress and backups */
export const ProgressSection = ({
  locations,
  pubsById,
  today,
  visits,
  visitedLocationIds,
  indexedVisits,
  onVisitsChange,
  crawl,
  prepareCrawl,
  onCrawlRestore,
  backup,
  crawlHistory = [],
  onCrawlHistoryRestore,
}: ProgressSectionProps) => (
  <section className="progress-grid">
    <StatsPanel visits={visits} pubsById={pubsById} today={today} />
    <Achievements
      locations={locations}
      visitedLocationIds={visitedLocationIds}
      indexedVisits={indexedVisits}
      crawls={crawlHistory}
    />
    <RarityProgress locations={locations} visitedLocationIds={visitedLocationIds} />
    <RegionBreakdown locations={locations} visitedLocationIds={visitedLocationIds} />
    <BackupPanel
      visits={visits}
      onVisitsChange={onVisitsChange}
      crawl={crawl}
      prepareCrawl={prepareCrawl}
      onCrawlRestore={onCrawlRestore}
      backup={backup}
      crawlHistory={crawlHistory}
      onCrawlHistoryRestore={onCrawlHistoryRestore}
    />
  </section>
);
