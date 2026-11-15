import { useState } from 'react';
import type { BackupControls } from '../backupReminder';
import { daysBetween } from '../backupReminder';

type BackupReminderProps = {
  backup: BackupControls;
  visitCount: number;
  today: string;
};

/**
 * Nudges the user to back up when they have visits that aren't in a
 * backup (see isBackupReminderDue). "Later" puts it off for a week.
 */
export const BackupReminder = ({ backup, visitCount, today }: BackupReminderProps) => {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const backUpNow = async () => {
    setSaving(true);
    setError(null);
    try {
      await backup.backUp();
    } catch (backupError) {
      setError(
        `Couldn't save the backup: ${backupError instanceof Error ? backupError.message : backupError}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const message = backup.lastBackup
    ? `Your last backup was ${daysBetween(backup.lastBackup, today)} days ago, and you've logged visits since.`
    : `Your ${visitCount} visits aren't backed up. If this device's storage is cleared, they'd be lost.`;

  return (
    <div className="backup-reminder" role="status">
      <p>
        <span aria-hidden="true">💾 </span>
        {message}
      </p>
      {error && <p className="backup-reminder-error">{error}</p>}
      <div className="backup-reminder-actions">
        <button
          type="button"
          className="backup-reminder-now"
          onClick={backUpNow}
          disabled={saving}
        >
          {saving ? 'Backing up…' : 'Back up now'}
        </button>
        <button type="button" className="visit-form-close" onClick={backup.snooze}>
          Later
        </button>
      </div>
    </div>
  );
};
