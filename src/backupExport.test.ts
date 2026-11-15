import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { exportBackup } from './backup';
import { useBackup, visitsSignature } from './backupReminder';
import { makeCrawl, makeVisit } from './test/fixtures';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn(() => false) } }));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: vi.fn() },
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}));
vi.mock('@capacitor/share', () => ({ Share: { share: vi.fn() } }));

const visits = [makeVisit(1, '2026-11-01')];

describe('exportBackup in a browser', () => {
  let saved: { name: string; text: Promise<string> } | null = null;

  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    saved = null;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      saved = { name: '', text: blob.text() };
      return 'blob:backup';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      if (saved) saved.name = this.download;
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('downloads a dated file with the visits and crawl', async () => {
    await expect(exportBackup(visits, makeCrawl(), '2026-11-15')).resolves.toBe(true);
    expect(saved?.name).toBe('spoons-collector-backup-2026-11-15.json');
    const contents = JSON.parse(await saved!.text);
    expect(contents).toMatchObject({ app: 'spoons_collector', version: 3, visits, crawl: { id: 'crawl-1' }, crawlHistory: [] });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:backup');
  });
});

describe('exportBackup in the Android app', () => {
  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Filesystem.writeFile).mockResolvedValue({ uri: 'file:///cache/backup.json' });
    vi.mocked(Share.share).mockReset();
  });

  it('writes the file and offers it in the share sheet', async () => {
    vi.mocked(Share.share).mockResolvedValue({});
    await expect(exportBackup(visits, null, '2026-11-15')).resolves.toBe(true);
    expect(Filesystem.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'spoons-collector-backup-2026-11-15.json', directory: 'CACHE' }),
    );
    expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({ files: ['file:///cache/backup.json'] }));
  });

  it('reports a closed share sheet as not saved', async () => {
    vi.mocked(Share.share).mockRejectedValue(new Error('Share canceled'));
    await expect(exportBackup(visits, null, '2026-11-15')).resolves.toBe(false);
  });

  it('passes on other failures', async () => {
    vi.mocked(Share.share).mockRejectedValue(new Error('No apps to share with'));
    await expect(exportBackup(visits, null, '2026-11-15')).rejects.toThrow('No apps to share with');
  });
});

describe('useBackup', () => {
  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Filesystem.writeFile).mockResolvedValue({ uri: 'file:///cache/backup.json' });
    vi.mocked(Share.share).mockReset().mockResolvedValue({});
  });

  const threeVisits = [makeVisit(1, '2026-09-01'), makeVisit(2, '2026-10-01'), makeVisit(3, '2026-11-01')];

  it('reminds a user with visits and no backup', () => {
    const { result } = renderHook(() => useBackup(threeVisits, null, '2026-11-15'));
    expect(result.current.lastBackup).toBeNull();
    expect(result.current.isReminderDue).toBe(true);
  });

  it('backing up records it and stops the reminder', async () => {
    const { result } = renderHook(() => useBackup(threeVisits, null, '2026-11-15'));
    await act(async () => {
      await result.current.backUp();
    });
    expect(result.current.lastBackup).toBe('2026-11-15');
    expect(result.current.isReminderDue).toBe(false);
    expect(window.localStorage.getItem('spoons-collector-last-backup-signature')).toBe(
      visitsSignature(threeVisits),
    );
  });

  it("doesn't record a backup the user didn't save", async () => {
    vi.mocked(Share.share).mockRejectedValue(new Error('cancelled'));
    const { result } = renderHook(() => useBackup(threeVisits, null, '2026-11-15'));
    await act(async () => {
      expect(await result.current.backUp()).toBe(false);
    });
    expect(result.current.lastBackup).toBeNull();
  });

  it('Later puts the reminder off for a week', () => {
    const { result } = renderHook(() => useBackup(threeVisits, null, '2026-11-15'));
    act(() => result.current.snooze());
    expect(result.current.isReminderDue).toBe(false);
    expect(window.localStorage.getItem('spoons-collector-backup-snoozed-until')).toBe('2026-11-22');
  });

  it('reads an earlier backup from this device', () => {
    window.localStorage.setItem('spoons-collector-last-backup', '2026-11-10');
    window.localStorage.setItem('spoons-collector-last-backup-signature', visitsSignature(threeVisits));
    const { result } = renderHook(() => useBackup(threeVisits, null, '2026-11-15'));
    expect(result.current.lastBackup).toBe('2026-11-10');
    expect(result.current.isReminderDue).toBe(false);
  });
});
