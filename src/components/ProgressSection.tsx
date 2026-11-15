import type { PubLocation, VisitEntry } from '../types';
import type { BackupControls } from '../backupReminder';
import type { Crawl } from '../crawl';
import { Achievements } from './Achievements';
import { RarityProgress } from './RarityProgress';
import { RegionBreakdown } from './RegionBreakdown';
import { BackupPanel } from './BackupPanel';

type ProgressSectionProps = {
  locations: PubLocation[];
  visits: VisitEntry[];
  visitedLocationIds: Set<number>;
  indexedVisits: Record<number, VisitEntry[]>;
  onVisitsChange: (visits: VisitEntry[]) => void;
  crawl: Crawl | null;
  prepareCrawl: (value: unknown) => Crawl | null;
  onCrawlRestore: (crawl: Crawl) => void;
  backup: BackupControls;
};

/** The cards under the map and list: achievements, progress and backups */
export const ProgressSection = ({
  locations,
  visits,
  visitedLocationIds,
  indexedVisits,
  onVisitsChange,
  crawl,
  prepareCrawl,
  onCrawlRestore,
  backup,
}: ProgressSectionProps) => (
  <section className="progress-grid">
    <Achievements
      locations={locations}
      visitedLocationIds={visitedLocationIds}
      indexedVisits={indexedVisits}
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
    />
  </section>
);
