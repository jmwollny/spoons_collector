import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { VisitEntry } from './types';
import type { Crawl } from './crawl';
import { readPhotoBase64 } from './photos';
import { sanitiseCrawlHistory, type CompletedCrawl } from './crawlScore';

// Identifies a backup file made by this app, and its format version.
// Version 2 added the crawl under way; version 3, visits' drinks, company
// and notes, and the crawls finished; version 4, visits' photos. Earlier
// versions are still read.
const BACKUP_APP = 'spoons_collector';
const BACKUP_VERSION = 4;

/** Visits' photos in a backup: base64 JPEG by visit id */
export type BackupPhotos = Record<string, string>;

type BackupFile = {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  visits: VisitEntry[];
  // The crawl under way when the backup was made (version 2 on)
  crawl?: Crawl | null;
  // Crawls finished (version 3 on)
  crawlHistory?: CompletedCrawl[];
  // Photos of visits (version 4 on); left out if the user chose to
  photos?: BackupPhotos;
};

export type Backup = {
  visits: VisitEntry[];
  // As found in the file: check it with sanitiseCrawl before using it
  crawl: unknown;
  crawlHistory: CompletedCrawl[];
  // Only photos of the backup's own visits
  photos: BackupPhotos;
};

/** The photos in a backup that belong to its visits; anything else is dropped */
const sanitisePhotos = (value: unknown, visits: VisitEntry[]): BackupPhotos => {
  if (typeof value !== 'object' || value === null) return {};
  const ids = new Set(visits.map((visit) => visit.id));
  return Object.fromEntries(
    Object.entries(value).filter(([id, photo]) => ids.has(id) && typeof photo === 'string' && photo.length > 0),
  );
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
    visit.rating <= 2 &&
    // Optional extras, from version 3
    ['drink', 'company', 'notes'].every(
      (field) => visit[field] === undefined || typeof visit[field] === 'string',
    ) &&
    (visit.hasPhoto === undefined || typeof visit.hasPhoto === 'boolean')
  );
};

/**
 * Reads the visits (and any crawl) from a backup file's text.
 * Throws an Error with a message fit to show the user if the file isn't one.
 */
export const parseBackup = (text: string): Backup => {
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
  return {
    visits: backup.visits,
    crawl: backup.crawl ?? null,
    crawlHistory: sanitiseCrawlHistory(backup.crawlHistory),
    photos: sanitisePhotos(backup.photos, backup.visits),
  };
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

/** The photos of the visits that have one on this device, for a backup */
export const collectPhotos = async (visits: VisitEntry[]): Promise<BackupPhotos> => {
  const photos: BackupPhotos = {};
  // One at a time, so a long list of photos isn't all read at once
  for (const visit of visits) {
    if (!visit.hasPhoto) continue;
    const photo = await readPhotoBase64(visit.id);
    if (photo) photos[visit.id] = photo;
  }
  return photos;
};

const backupFileName = (date: string) => `spoons-collector-backup-${date}.json`;

/**
 * Saves the visits, and the crawl under way, as a backup file: a download
 * in a browser, and the share sheet on a phone (to save it to Drive or
 * Files, or send it).
 * @returns false if the share sheet was closed without saving
 */
export const exportBackup = async (
  visits: VisitEntry[],
  crawl: Crawl | null,
  today: string,
  crawlHistory: CompletedCrawl[] = [],
  photos: BackupPhotos = {},
): Promise<boolean> => {
  const backup: BackupFile = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    visits,
    crawl,
    crawlHistory,
    photos,
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
