import { useRef, useState } from 'react';
import type { VisitEntry } from '../types';
import { mergeVisits, parseBackup } from '../backup';
import type { BackupControls } from '../backupReminder';
import type { Crawl } from '../crawl';
import { formatDate } from '../utils';
import { ActionButton } from './ActionButton';
import { ConfirmDialog } from './ConfirmDialog';

type BackupPanelProps = {
  visits: VisitEntry[];
  onVisitsChange: (visits: VisitEntry[]) => void;
  // The crawl under way, if any
  crawl: Crawl | null;
  // Checks a crawl from a backup file; null if it isn't usable
  prepareCrawl: (value: unknown) => Crawl | null;
  onCrawlRestore: (crawl: Crawl) => void;
  backup: BackupControls;
};

type Status = { kind: 'success' | 'error'; text: string } | null;

type PendingRestore = {
  visits: VisitEntry[];
  addedCount: number;
  fileCount: number;
  // The backup's crawl, restored only if there's no crawl under way
  crawl: Crawl | null;
  // Whether the backup had a crawl we're not restoring over the current one
  crawlSkipped: boolean;
};

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Backs up the visits (and any crawl under way) to a file and restores them
 * from one. Visits otherwise live only on this browser or phone.
 */
export const BackupPanel = ({
  visits,
  onVisitsChange,
  crawl,
  prepareCrawl,
  onCrawlRestore,
  backup,
}: BackupPanelProps) => {
  const [status, setStatus] = useState<Status>(null);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setStatus(null);
    try {
      const saved = await backup.backUp();
      if (!saved) {
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

  const handleFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again still triggers a change
    event.target.value = '';
    if (!file) {
      return;
    }

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
      setStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const confirmRestore = () => {
    if (!pendingRestore) {
      return;
    }
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

  return (
    <div className="card">
      <div className="section-heading">
        <h2>Your visits</h2>
        <p>
          Visits are only saved on this device. Back them up (with any crawl
          under way) to keep them safe or move them to another device.
        </p>
      </div>

      <div className="backup-actions">
        <ActionButton onClick={handleBackup} disabled={visits.length === 0 && !crawl}>
          Back up visits
        </ActionButton>
        <button
          type="button"
          className="visit-form-close"
          onClick={() => fileInput.current?.click()}
        >
          Restore from backup
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="backup-file-input"
          onChange={handleFileChosen}
        />
      </div>

      <p className="backup-last">
        Last backup on this device:{' '}
        <strong>{backup.lastBackup ? formatDate(backup.lastBackup) : 'never'}</strong>
      </p>

      {status && (
        <p className={`backup-status backup-status--${status.kind}`} role="status">
          {status.text}
        </p>
      )}

      {pendingRestore && (
        <ConfirmDialog
          title="Restore visits?"
          message={
            <>
              The backup has {plural(pendingRestore.fileCount, 'visit')}.{' '}
              {plural(pendingRestore.addedCount, 'visit')} will be added to the{' '}
              {plural(visits.length, 'visit')} already here. Nothing here is removed
              or changed.
              {pendingRestore.crawl &&
                ` It also has a crawl of ${plural(pendingRestore.crawl.stops.length, 'pub')} from ${pendingRestore.crawl.startLabel}, which will be restored too.`}
              {pendingRestore.crawlSkipped &&
                " Its crawl isn't restored, as you have one under way."}
            </>
          }
          confirmLabel="Restore"
          onConfirm={confirmRestore}
          onCancel={() => setPendingRestore(null)}
        />
      )}
    </div>
  );
};
