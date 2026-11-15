import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackupPanel } from './BackupPanel';
import { BackupReminder } from './BackupReminder';
import { ProgressSection } from './ProgressSection';
import type { BackupControls } from '../backupReminder';
import { makeCrawl, makeVisit, samplePubs, samplePubsById } from '../test/fixtures';
import type { Crawl } from '../crawl';

const visits = [makeVisit(1, '2026-11-01'), makeVisit(2, '2026-11-02')];

const controls = (overrides: Partial<BackupControls> = {}): BackupControls => ({
  lastBackup: null,
  backUp: vi.fn().mockResolvedValue(true),
  isReminderDue: true,
  snooze: vi.fn(),
  ...overrides,
});

const backupFile = (contents: object) =>
  new File([JSON.stringify(contents)], 'backup.json', { type: 'application/json' });

const renderPanel = (overrides: Partial<React.ComponentProps<typeof BackupPanel>> = {}) => {
  const props = {
    visits,
    onVisitsChange: vi.fn(),
    crawl: null as Crawl | null,
    prepareCrawl: vi.fn((value: unknown) => (value ? (value as Crawl) : null)),
    onCrawlRestore: vi.fn(),
    backup: controls(),
    ...overrides,
  };
  render(<BackupPanel {...props} />);
  return props;
};

const restoreFrom = (file: File) => userEvent.upload(screen.getByLabelText('Backup file'), file);

describe('BackupPanel', () => {
  it('says when this device last backed up', () => {
    const { rerender } = render(
      <BackupPanel
        visits={visits}
        onVisitsChange={vi.fn()}
        crawl={null}
        prepareCrawl={vi.fn()}
        onCrawlRestore={vi.fn()}
        backup={controls()}
      />,
    );
    expect(screen.getByText(/Last backup on this device/)).toHaveTextContent('never');
    rerender(
      <BackupPanel
        visits={visits}
        onVisitsChange={vi.fn()}
        crawl={null}
        prepareCrawl={vi.fn()}
        onCrawlRestore={vi.fn()}
        backup={controls({ lastBackup: '2026-11-10' })}
      />,
    );
    expect(screen.getByText(/Last backup on this device/)).toHaveTextContent('10 Nov 2026');
  });

  it('backs up and says how many visits', async () => {
    const props = renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Back up visits' }));
    expect(props.backup.backUp).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent('Backed up 2 visits.');
  });

  it('mentions the crawl when there is one', async () => {
    renderPanel({ crawl: makeCrawl() });
    await userEvent.click(screen.getByRole('button', { name: 'Back up visits' }));
    expect(screen.getByRole('status')).toHaveTextContent('Backed up 2 visits and your crawl.');
  });

  it('says nothing if the share sheet was closed without saving', async () => {
    renderPanel({ backup: controls({ backUp: vi.fn().mockResolvedValue(false) }) });
    await userEvent.click(screen.getByRole('button', { name: 'Back up visits' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says when a backup fails', async () => {
    renderPanel({ backup: controls({ backUp: vi.fn().mockRejectedValue(new Error('Disk full')) }) });
    await userEvent.click(screen.getByRole('button', { name: 'Back up visits' }));
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't save the backup: Disk full");
  });

  it("can't back up with nothing to back up", () => {
    renderPanel({ visits: [] });
    expect(screen.getByRole('button', { name: 'Back up visits' })).toBeDisabled();
  });

  it('opens the file picker from Restore', async () => {
    renderPanel();
    const input = screen.getByLabelText<HTMLInputElement>('Backup file');
    const click = vi.spyOn(input, 'click');
    await userEvent.click(screen.getByRole('button', { name: 'Restore from backup' }));
    expect(click).toHaveBeenCalledOnce();
  });

  it('restores new visits from a backup after asking', async () => {
    const props = renderPanel();
    await restoreFrom(
      backupFile({ app: 'spoons_collector', version: 2, visits: [...visits, makeVisit(3, '2026-11-03')] }),
    );
    const dialog = await screen.findByRole('alertdialog', { name: 'Restore visits?' });
    expect(dialog).toHaveTextContent(
      'The backup has 3 visits. 1 visit will be added to the 2 visits already here.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restore' }));
    expect(props.onVisitsChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ locationId: 3 })]),
    );
    expect(vi.mocked(props.onVisitsChange).mock.calls[0][0]).toHaveLength(3);
    expect(screen.getByRole('status')).toHaveTextContent('Restored 1 visit.');
  });

  it("restores nothing if the user cancels", async () => {
    const props = renderPanel();
    await restoreFrom(backupFile({ app: 'spoons_collector', version: 2, visits: [makeVisit(3, '2026-11-03')] }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(props.onVisitsChange).not.toHaveBeenCalled();
  });

  it('says when there is nothing new to restore', async () => {
    renderPanel();
    await restoreFrom(backupFile({ app: 'spoons_collector', version: 2, visits }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Nothing to restore: every visit in that backup is already here.',
    );
  });

  it("says when a file isn't a backup", async () => {
    renderPanel();
    await restoreFrom(new File(['not json'], 'notes.json', { type: 'application/json' }));
    expect(await screen.findByRole('status')).toHaveTextContent("That file isn't a Spoons Collector backup.");
  });

  it("restores the backup's crawl when there isn't one under way", async () => {
    const crawl = makeCrawl();
    const props = renderPanel();
    await restoreFrom(backupFile({ app: 'spoons_collector', version: 2, visits, crawl }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('It also has a crawl of 2 pubs from The Cuthbert Brodrick, Leeds');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restore' }));
    expect(props.onCrawlRestore).toHaveBeenCalledWith(crawl);
    expect(screen.getByRole('status')).toHaveTextContent('Restored 0 visits and your crawl.');
  });

  it("doesn't replace a crawl under way, and says so", async () => {
    const props = renderPanel({ crawl: makeCrawl({ id: 'current' }) });
    await restoreFrom(
      backupFile({
        app: 'spoons_collector',
        version: 2,
        visits: [makeVisit(3, '2026-11-03')],
        crawl: makeCrawl({ id: 'old' }),
      }),
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent("Its crawl isn't restored, as you have one under way.");
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restore' }));
    expect(props.onCrawlRestore).not.toHaveBeenCalled();
  });
});

describe('BackupPanel and finished crawls', () => {
  const done = { id: 'c1', date: '2026-11-01', pubCount: 3, totalMiles: 1, mode: 'walk', score: 90, meals: [], treasureHunt: false, revealedCount: 0 };

  it('restores finished crawls not here yet', async () => {
    const onCrawlHistoryRestore = vi.fn();
    renderPanel({ onCrawlHistoryRestore, crawlHistory: [] });
    await restoreFrom(backupFile({ app: 'spoons_collector', version: 3, visits, crawlHistory: [done] }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('It also has 1 finished crawl, for your achievements.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restore' }));
    expect(onCrawlHistoryRestore).toHaveBeenCalledWith([done]);
    expect(screen.getByRole('status')).toHaveTextContent('Restored 0 visits and 1 finished crawl.');
  });

  it('has nothing to restore when it already has them', async () => {
    renderPanel({ crawlHistory: [done as never] });
    await restoreFrom(backupFile({ app: 'spoons_collector', version: 3, visits, crawlHistory: [done] }));
    expect(await screen.findByRole('status')).toHaveTextContent('Nothing to restore');
  });
});

describe('BackupReminder', () => {
  it('nudges a user who has never backed up', () => {
    render(<BackupReminder backup={controls()} visitCount={5} today="2026-11-15" />);
    expect(screen.getByRole('status')).toHaveTextContent(
      "Your 5 visits aren't backed up. If this device's storage is cleared, they'd be lost.",
    );
  });

  it('says how old the last backup is', () => {
    render(<BackupReminder backup={controls({ lastBackup: '2026-10-01' })} visitCount={5} today="2026-11-15" />);
    expect(screen.getByRole('status')).toHaveTextContent(
      "Your last backup was 45 days ago, and you've logged visits since.",
    );
  });

  it('backs up now, showing progress', async () => {
    let finish: (saved: boolean) => void = () => {};
    const backup = controls({ backUp: vi.fn(() => new Promise<boolean>((resolve) => (finish = resolve))) });
    render(<BackupReminder backup={backup} visitCount={5} today="2026-11-15" />);
    await userEvent.click(screen.getByRole('button', { name: 'Back up now' }));
    expect(screen.getByRole('button', { name: 'Backing up…' })).toBeDisabled();
    finish(true);
    expect(await screen.findByRole('button', { name: 'Back up now' })).toBeEnabled();
  });

  it('says when backing up fails', async () => {
    const backup = controls({ backUp: vi.fn().mockRejectedValue(new Error('No space')) });
    render(<BackupReminder backup={backup} visitCount={5} today="2026-11-15" />);
    await userEvent.click(screen.getByRole('button', { name: 'Back up now' }));
    expect(await screen.findByText("Couldn't save the backup: No space")).toBeInTheDocument();
  });

  it('puts the reminder off with Later', async () => {
    const backup = controls();
    render(<BackupReminder backup={backup} visitCount={5} today="2026-11-15" />);
    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(backup.snooze).toHaveBeenCalledOnce();
  });
});

describe('ProgressSection', () => {
  it('shows achievements, rarity, regions and backups', () => {
    render(
      <ProgressSection
        locations={samplePubs}
        pubsById={samplePubsById}
        today="2026-11-15"
        visits={visits}
        visitedLocationIds={new Set([1, 2])}
        indexedVisits={{ 1: [visits[0]], 2: [visits[1]] }}
        onVisitsChange={vi.fn()}
        crawl={null}
        prepareCrawl={vi.fn()}
        onCrawlRestore={vi.fn()}
        backup={controls()}
      />,
    );
    for (const heading of ['Your stats', 'Achievements', 'Rarity', 'Regions', 'Your visits']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
  });
});
