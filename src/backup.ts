import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { VisitEntry } from './types';

// Identifies a backup file made by this app, and its format version
const BACKUP_APP = 'spoons_collector';
const BACKUP_VERSION = 1;

type BackupFile = {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  visits: VisitEntry[];
};

const isVisitEntry = (value: unknown): value is VisitEntry => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const visit = value as Record<string, unknown>;
  return (
    typeof visit.id === 'string' &&
    typeof visit.locationId === 'number' &&
    typeof visit.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(visit.date) &&
    typeof visit.rating === 'number' &&
    Number.isInteger(visit.rating) &&
    visit.rating >= -1 &&
    visit.rating <= 2
  );
};

/**
 * Reads the visits from a backup file's text.
 * Throws an Error with a message fit to show the user if the file isn't one.
 */
export const parseBackup = (text: string): VisitEntry[] => {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a Spoons Collector backup.");
  }

  const backup = data as Partial<BackupFile>;
  if (backup?.app !== BACKUP_APP || !Array.isArray(backup.visits)) {
    throw new Error("That file isn't a Spoons Collector backup.");
  }
  if (typeof backup.version !== 'number' || backup.version > BACKUP_VERSION) {
    throw new Error('That backup was made by a newer version of the app.');
  }
  if (!backup.visits.every(isVisitEntry)) {
    throw new Error('That backup is damaged: some of its visits are unreadable.');
  }
  return backup.visits;
};

/**
 * Adds the backed-up visits to the current ones. A visit already present
 * (same id) is kept as it is, so restoring the same file twice changes nothing.
 * The result is newest first, which is the order the app expects.
 */
export const mergeVisits = (current: VisitEntry[], restored: VisitEntry[]) => {
  const knownIds = new Set(current.map((visit) => visit.id));
  const added = restored.filter((visit) => !knownIds.has(visit.id));
  const visits = [...current, ...added].sort((a, b) => b.date.localeCompare(a.date));
  return { visits, addedCount: added.length };
};

const backupFileName = (date: string) => `spoons-collector-backup-${date}.json`;

/**
 * Saves the visits as a backup file: a download in a browser, and the
 * share sheet on a phone (to save it to Drive or Files, or send it).
 * @returns false if the share sheet was closed without saving
 */
export const exportVisits = async (
  visits: VisitEntry[],
  today: string,
): Promise<boolean> => {
  const backup: BackupFile = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    visits,
  };
  const text = JSON.stringify(backup, null, 2);
  const fileName = backupFileName(today);

  if (Capacitor.isNativePlatform()) {
    // The Android web view can't download files, so write one and share it
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    try {
      await Share.share({
        title: 'Spoons Collector backup',
        files: [uri],
        dialogTitle: 'Save your visits backup',
      });
    } catch (error) {
      if (error instanceof Error && /cancel/i.test(error.message)) {
        return false;
      }
      throw error;
    }
    return true;
  }

  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
};
