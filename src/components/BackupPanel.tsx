import { useRef } from 'react';
import type { VisitEntry } from '../types';
import type { BackupControls } from '../backupReminder';
import type { Crawl } from '../crawl';
import type { CompletedCrawl } from '../crawlScore';
import { useBackupRestore } from '../hooks/useBackupRestore';
import { formatDate } from '../utils';
import { ActionButton } from './ActionButton';
import { RestoreConfirmDialog } from './backup/RestoreConfirmDialog';

type BackupPanelProps = {
  visits: VisitEntry[];
  onVisitsChange: (visits: VisitEntry[]) => void;
  // The crawl under way, if any
  crawl: Crawl | null;
  // Checks a crawl from a backup file; null if it isn't usable
  prepareCrawl: (value: unknown) => Crawl | null;
  onCrawlRestore: (crawl: Crawl) => void;
  backup: BackupControls;
  crawlHistory?: CompletedCrawl[];
  onCrawlHistoryRestore?: (crawls: CompletedCrawl[]) => void;
};

/**
 * Backs up the visits (and any crawl under way) to a file and restores them
 * from one. Visits otherwise live only on this browser or phone.
 */
export const BackupPanel = (props: BackupPanelProps) => {
  const { visits, crawl, backup } = props;
  const restore = useBackupRestore(props);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFileChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again still triggers a change
    event.target.value = '';
    if (file) {
      void restore.readFile(file);
    }
  };

  return (
    <div className="card">
      <div className="section-heading">
        <h2>Your visits</h2>
        <p>
          Visits are only saved on this device. Back them up (with any crawl under way) to keep them
          safe or move them to another device.
        </p>
      </div>

      <div className="backup-actions">
        <ActionButton onClick={restore.backUp} disabled={visits.length === 0 && !crawl}>
          Back up visits
        </ActionButton>
        <button type="button" className="visit-form-close" onClick={() => fileInput.current?.click()}>
          Restore from backup
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="backup-file-input"
          aria-label="Backup file"
          onChange={handleFileChosen}
        />
      </div>

      <p className="backup-last">
        Last backup on this device:{' '}
        <strong>{backup.lastBackup ? formatDate(backup.lastBackup) : 'never'}</strong>
      </p>

      {restore.status && (
        <p className={`backup-status backup-status--${restore.status.kind}`} role="status">
          {restore.status.text}
        </p>
      )}

      {restore.pendingRestore && (
        <RestoreConfirmDialog
          restore={restore.pendingRestore}
          currentCount={visits.length}
          onConfirm={restore.confirmRestore}
          onCancel={restore.cancelRestore}
        />
      )}
    </div>
  );
};
