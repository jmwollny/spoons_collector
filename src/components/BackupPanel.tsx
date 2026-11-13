import { useRef, useState } from 'react';
import type { VisitEntry } from '../types';
import { exportVisits, mergeVisits, parseBackup } from '../backup';
import { formatDate } from '../utils';
import { ActionButton } from './ActionButton';
import { ConfirmDialog } from './ConfirmDialog';

type BackupPanelProps = {
  visits: VisitEntry[];
  onVisitsChange: (visits: VisitEntry[]) => void;
  today: string;
};

// When this device last made a backup. Only a reminder, so it lives in local
// storage next to the visits.
const lastBackupKey = 'spoons-collector-last-backup';

const readLastBackup = () => {
  try {
    return window.localStorage.getItem(lastBackupKey);
  } catch {
    return null;
  }
};

type Status = { kind: 'success' | 'error'; text: string } | null;

type PendingRestore = {
  visits: VisitEntry[];
  addedCount: number;
  fileCount: number;
};

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Backs up the visits to a file and restores them from one. Visits otherwise
 * live only in this browser or phone, and are lost if its data is cleared.
 */
export const BackupPanel = ({ visits, onVisitsChange, today }: BackupPanelProps) => {
  const [lastBackup, setLastBackup] = useState(readLastBackup);
  const [status, setStatus] = useState<Status>(null);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setStatus(null);
    try {
      const saved = await exportVisits(visits, today);
      if (!saved) {
        return;
      }
      try {
        window.localStorage.setItem(lastBackupKey, today);
      } catch {
        // Only the reminder is lost
      }
      setLastBackup(today);
      setStatus({ kind: 'success', text: `Backed up ${plural(visits.length, 'visit')}.` });
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
      const { visits: merged, addedCount } = mergeVisits(visits, restored);
      if (addedCount === 0) {
        setStatus({
          kind: 'success',
          text: 'Nothing to restore: every visit in that backup is already here.',
        });
        return;
      }
      setPendingRestore({ visits: merged, addedCount, fileCount: restored.length });
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
    setStatus({
      kind: 'success',
      text: `Restored ${plural(pendingRestore.addedCount, 'visit')}.`,
    });
    setPendingRestore(null);
  };

  return (
    <div className="card">
      <div className="section-heading">
        <h2>Your visits</h2>
        <p>
          Visits are only saved on this device. Back them up to keep them safe or
          move them to another device.
        </p>
      </div>

      <div className="backup-actions">
        <ActionButton onClick={handleBackup} disabled={visits.length === 0}>
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
        <strong>{lastBackup ? formatDate(lastBackup) : 'never'}</strong>
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
