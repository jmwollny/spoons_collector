import { useState } from 'react';
import type { VisitEntry } from './types';
import type { Crawl } from './crawl';
import { exportBackup } from './backup';
import type { CompletedCrawl } from './crawlScore';

// When this device last made a backup, and a fingerprint of the visits it
// held, so the reminder knows whether anything has changed since. Only for
// the reminder, so they live in local storage.
const lastBackupKey = 'spoons-collector-last-backup';
const lastBackupSignatureKey = 'spoons-collector-last-backup-signature';
// "Later" puts the reminder off until this date
const snoozeKey = 'spoons-collector-backup-snoozed-until';

// Remind once the last backup is this old and visits have changed since
export const REMIND_AFTER_DAYS = 30;
// Without any backup yet, remind once there are this many visits
export const REMIND_FIRST_AT_VISITS = 3;
export const SNOOZE_DAYS = 7;

/** A short fingerprint of the visits, which changes if any visit does */
export const visitsSignature = (visits: VisitEntry[]) => {
  const text = JSON.stringify(
    [...visits]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((visit) => [visit.id, visit.locationId, visit.date, visit.rating]),
  );
  // FNV-1a: plenty to tell one list of visits from another
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${visits.length}:${(hash >>> 0).toString(16)}`;
};

/** Whole days from one YYYY-MM-DD date to another */
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** YYYY-MM-DD a number of days after a date */
export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export type BackupRecord = {
  // YYYY-MM-DD, or null if this device has never made a backup
  date: string | null;
  // Fingerprint of the visits backed up; null for backups made before
  // fingerprints were kept
  signature: string | null;
};

/**
 * Whether to remind the user to back up: they have visits that aren't in
 * a backup, and either have never made one (once they have a few visits)
 * or the last one is a month old. Not while "Later" is in force.
 */
export const isBackupReminderDue = (
  visits: VisitEntry[],
  record: BackupRecord,
  today: string,
  snoozedUntil: string | null,
) => {
  if (visits.length === 0) return false;
  if (snoozedUntil && today < snoozedUntil) return false;
  if (record.signature !== null && record.signature === visitsSignature(visits)) return false;
  if (record.date === null) return visits.length >= REMIND_FIRST_AT_VISITS;
  return daysBetween(record.date, today) >= REMIND_AFTER_DAYS;
};

const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Only the reminder is affected
  }
};

/**
 * Making backups, and whether to remind the user to. Shared by the backup
 * panel and the reminder banner.
 */
export const useBackup = (
  visits: VisitEntry[],
  crawl: Crawl | null,
  today: string,
  crawlHistory: CompletedCrawl[] = [],
) => {
  const [record, setRecord] = useState<BackupRecord>(() => ({
    date: read(lastBackupKey),
    signature: read(lastBackupSignatureKey),
  }));
  const [snoozedUntil, setSnoozedUntil] = useState(() => read(snoozeKey));

  /** @returns false if the user closed the share sheet without saving */
  const backUp = async () => {
    const saved = await exportBackup(visits, crawl, today, crawlHistory);
    if (saved) {
      const signature = visitsSignature(visits);
      write(lastBackupKey, today);
      write(lastBackupSignatureKey, signature);
      setRecord({ date: today, signature });
    }
    return saved;
  };

  const snooze = () => {
    const until = addDays(today, SNOOZE_DAYS);
    write(snoozeKey, until);
    setSnoozedUntil(until);
  };

  return {
    lastBackup: record.date,
    backUp,
    isReminderDue: isBackupReminderDue(visits, record, today, snoozedUntil),
    snooze,
  };
};

export type BackupControls = ReturnType<typeof useBackup>;
