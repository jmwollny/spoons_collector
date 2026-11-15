import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isBackupReminderDue, visitsSignature } from './backupReminder';
import { makeVisit } from './test/pubs';

const three = [
  makeVisit(1, '2026-09-01'),
  makeVisit(2, '2026-10-01'),
  makeVisit(3, '2026-11-01'),
];
const today = '2026-11-15';
const never = { date: null, signature: null };

describe('visitsSignature', () => {
  it("doesn't depend on the order of the visits", () => {
    expect(visitsSignature(three)).toBe(visitsSignature([...three].reverse()));
  });

  it('changes when a visit is added, edited or removed', () => {
    const base = visitsSignature(three);
    expect(visitsSignature([...three, makeVisit(4, '2026-11-10')])).not.toBe(base);
    expect(visitsSignature([{ ...three[0], rating: 0 }, three[1], three[2]])).not.toBe(base);
    expect(visitsSignature(three.slice(1))).not.toBe(base);
  });
});

describe('dates', () => {
  it('counts days and adds them', () => {
    expect(daysBetween('2026-10-16', '2026-11-15')).toBe(30);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2); // across the clocks changing
    expect(addDays('2026-12-30', 7)).toBe('2027-01-06');
  });
});

describe('isBackupReminderDue', () => {
  it('is quiet with no visits', () => {
    expect(isBackupReminderDue([], never, today, null)).toBe(false);
  });

  it('reminds once there are a few visits and no backup yet', () => {
    expect(isBackupReminderDue(three.slice(0, 2), never, today, null)).toBe(false);
    expect(isBackupReminderDue(three, never, today, null)).toBe(true);
  });

  it('is quiet when nothing has changed since the last backup, however old', () => {
    const record = { date: '2025-01-01', signature: visitsSignature(three) };
    expect(isBackupReminderDue(three, record, today, null)).toBe(false);
  });

  it('reminds when visits changed and the last backup is a month old', () => {
    const signature = visitsSignature(three.slice(0, 2));
    expect(isBackupReminderDue(three, { date: '2026-10-20', signature }, today, null)).toBe(false);
    expect(isBackupReminderDue(three, { date: '2026-10-16', signature }, today, null)).toBe(true);
  });

  it('treats an old backup without a fingerprint as changed', () => {
    expect(isBackupReminderDue(three, { date: '2026-10-01', signature: null }, today, null)).toBe(true);
  });

  it('stays quiet while "Later" is in force', () => {
    expect(isBackupReminderDue(three, never, today, '2026-11-20')).toBe(false);
    expect(isBackupReminderDue(three, never, today, '2026-11-15')).toBe(true);
  });
});
