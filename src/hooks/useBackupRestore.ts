import { useState } from 'react';
import type { VisitEntry } from '../types';
import type { Crawl } from '../crawl';
import type { BackupControls } from '../backupReminder';
import { mergeVisits, parseBackup } from '../backup';
import { plural } from '../utils';

export type BackupStatus = { kind: 'success' | 'error'; text: string } | null;

/** A restore read from a file, waiting for the user to confirm it */
export type PendingRestore = {
  // The visits after restoring: those here plus the backup's new ones
  visits: VisitEntry[];
  addedCount: number;
  // How many visits the file holds
  fileCount: number;
  // The backup's crawl, restored only if there's no crawl under way
  crawl: Crawl | null;
  // Whether the backup had a crawl we're not restoring over the current one
  crawlSkipped: boolean;
};

type BackupRestoreOptions = {
  visits: VisitEntry[];
  onVisitsChange: (visits: VisitEntry[]) => void;
  crawl: Crawl | null;
  // Checks a crawl from a backup file; null if it isn't usable
  prepareCrawl: (value: unknown) => Crawl | null;
  onCrawlRestore: (crawl: Crawl) => void;
  backup: BackupControls;
};

/** Backing up to a file and restoring from one, with messages for the user */
export const useBackupRestore = ({
  visits,
  onVisitsChange,
  crawl,
  prepareCrawl,
  onCrawlRestore,
  backup,
}: BackupRestoreOptions) => {
  const [status, setStatus] = useState<BackupStatus>(null);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);

  const backUp = async () => {
    setStatus(null);
    try {
      if (!(await backup.backUp())) {
        // The share sheet was closed without saving
        return;
      }
      setStatus({
        kind: 'success',
        text: `Backed up ${plural(visits.length, 'visit')}${crawl ? ' and your crawl' : ''}.`,
      });
    } catch (error) {
      setStatus({
        kind: 'error',
        text: `Couldn't save the backup: ${error instanceof Error ? error.message : error}`,
      });
    }
  };

  /** Reads a backup file and, if it has anything new, asks to restore it */
  const readFile = async (file: File) => {
    setStatus(null);
    try {
      const restored = parseBackup(await file.text());
      const { visits: merged, addedCount } = mergeVisits(visits, restored.visits);
      const backupCrawl = prepareCrawl(restored.crawl);
      const crawlToRestore = crawl ? null : backupCrawl;
      if (addedCount === 0 && !crawlToRestore) {
        setStatus({
          kind: 'success',
          text: 'Nothing to restore: every visit in that backup is already here.',
        });
        return;
      }
      setPendingRestore({
        visits: merged,
        addedCount,
        fileCount: restored.visits.length,
        crawl: crawlToRestore,
        crawlSkipped: Boolean(backupCrawl && crawl),
      });
    } catch (error) {
      setStatus({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
    }
  };

  const confirmRestore = () => {
    if (!pendingRestore) return;
    onVisitsChange(pendingRestore.visits);
    if (pendingRestore.crawl) {
      onCrawlRestore(pendingRestore.crawl);
    }
    setStatus({
      kind: 'success',
      text: `Restored ${plural(pendingRestore.addedCount, 'visit')}${
        pendingRestore.crawl ? ' and your crawl' : ''
      }.`,
    });
    setPendingRestore(null);
  };

  return {
    status,
    pendingRestore,
    backUp,
    readFile,
    confirmRestore,
    cancelRestore: () => setPendingRestore(null),
  };
};
