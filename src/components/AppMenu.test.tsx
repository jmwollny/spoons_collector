import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppMenu } from './AppMenu';
import { ProgressSection } from './ProgressSection';
import { BackupReminder } from './BackupReminder';
import type { BackupControls } from '../backupReminder';
import { makeCrawl, makeVisit, samplePubs, samplePubsById } from '../test/fixtures';
import type { Crawl } from '../crawl';
import { hasStoredPhoto, restorePhoto } from '../photos';

vi.mock('../photos', () => ({ hasStoredPhoto: vi.fn(), restorePhoto: vi.fn() }));

const visits = [makeVisit(1, '2026-11-01'), makeVisit(2, '2026-11-02')];

const controls = (overrides: Partial<BackupControls> = {}): BackupControls => ({
  lastBackup: null,
  backUp: vi.fn().mockResolvedValue(true),
  isReminderDue: true,
  snooze: vi.fn(),
  includePhotos: true,
  toggleIncludePhotos: vi.fn(),
  ...overrides,
});

const backupFile = (contents: object) =>
  new File([JSON.stringify(contents)], 'backup.json', { type: 'application/json' });

const renderPanel = (overrides: Partial<React.ComponentProps<typeof AppMenu>> = {}) => {
  const props = {
    visits,
    onVisitsChange: vi.fn(),
    crawl: null as Crawl | null,
    prepareCrawl: vi.fn((value: unknown) => (value ? (value as Crawl) : null)),
    onCrawlRestore: vi.fn(),
    backup: controls(),
    crawlHistory: [],
    onCrawlHistoryRestore: vi.fn(),
    isLiveLocationOn: false,
    onToggleLiveLocation: vi.fn(),
    ...overrides,
  };
  render(<AppMenu {...props} />);
  return props;
};

const openMenu = () => userEvent.click(screen.getByRole('button', { name: 'Menu' }));
const choose = async (item: string) => {
  await openMenu();
  await userEvent.click(screen.getByRole('button', { name: item }));
};

const restoreFrom = (file: File) => userEvent.upload(screen.getByLabelText('Backup file'), file);

describe('AppMenu: backing up and restoring', () => {
  it('opens from ☰ and says when this device last backed up', async () => {
    const menuProps = {
      visits,
      onVisitsChange: vi.fn(),
      crawl: null,
      prepareCrawl: vi.fn(),
      onCrawlRestore: vi.fn(),
      crawlHistory: [],
      onCrawlHistoryRestore: vi.fn(),
      isLiveLocationOn: false,
      onToggleLiveLocation: vi.fn(),
    };
    const { rerender } = render(<AppMenu {...menuProps} backup={controls()} />);
    const button = screen.getByRole('button', { name: 'Menu' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: '💾 Back up visits' })).not.toBeInTheDocument();
    await openMenu();
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Last backup/)).toHaveTextContent('never');
    rerender(<AppMenu {...menuProps} backup={controls({ lastBackup: '2026-11-10' })} />);
    expect(screen.getByText(/Last backup/)).toHaveTextContent('10 Nov 2026');
  });

  it('closes on ☰ again, Escape, or a click elsewhere', async () => {
    renderPanel();
    await openMenu();
    await openMenu();
    expect(screen.queryByRole('button', { name: '💾 Back up visits' })).not.toBeInTheDocument();
    await openMenu();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: '💾 Back up visits' })).not.toBeInTheDocument();
    await openMenu();
    await userEvent.click(document.body);
    expect(screen.queryByRole('button', { name: '💾 Back up visits' })).not.toBeInTheDocument();
  });

  it('backs up and says how many visits', async () => {
    const props = renderPanel();
    await choose('💾 Back up visits');
    expect(props.backup.backUp).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent('Backed up 2 visits.');
  });

  it('mentions the crawl when there is one', async () => {
    renderPanel({ crawl: makeCrawl() });
    await choose('💾 Back up visits');
    expect(screen.getByRole('status')).toHaveTextContent('Backed up 2 visits and your crawl.');
  });

  it('says nothing if the share sheet was closed without saving', async () => {
    renderPanel({ backup: controls({ backUp: vi.fn().mockResolvedValue(false) }) });
    await choose('💾 Back up visits');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says when a backup fails', async () => {
    renderPanel({ backup: controls({ backUp: vi.fn().mockRejectedValue(new Error('Disk full')) }) });
    await choose('💾 Back up visits');
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't save the backup: Disk full");
  });

  it("can't back up with nothing to back up", async () => {
    renderPanel({ visits: [] });
    await openMenu();
    expect(screen.getByRole('button', { name: '💾 Back up visits' })).toBeDisabled();
  });

  it('opens the file picker from Restore', async () => {
    renderPanel();
    const input = screen.getByLabelText<HTMLInputElement>('Backup file');
    const click = vi.spyOn(input, 'click');
    await choose('📂 Restore from backup');
    expect(click).toHaveBeenCalledOnce();
    // The menu closes, leaving the file picker
    expect(screen.queryByRole('button', { name: '💾 Back up visits' })).not.toBeInTheDocument();
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

  it("restores the backup's photos that aren't on this device, before the visits", async () => {
    const withPhoto = makeVisit(1, '2026-11-01', { hasPhoto: true });
    const added = makeVisit(3, '2026-11-03', { hasPhoto: true });
    // The photo of the visit already here is still here
    vi.mocked(hasStoredPhoto).mockImplementation(async (id) => id === withPhoto.id);
    vi.mocked(restorePhoto).mockReset().mockResolvedValue(undefined);
    const props = renderPanel({ visits: [withPhoto, visits[1]] });
    vi.mocked(props.onVisitsChange).mockImplementation(() =>
      expect(restorePhoto).toHaveBeenCalledWith(added.id, 'bmV3'),
    );
    await restoreFrom(
      backupFile({
        app: 'spoons_collector',
        version: 4,
        visits: [withPhoto, added],
        photos: { [withPhoto.id]: 'b2xk', [added.id]: 'bmV3' },
      }),
    );
    const dialog = await screen.findByRole('alertdialog', { name: 'Restore visits?' });
    expect(dialog).toHaveTextContent('1 photo will be restored too.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restore' }));
    expect(restorePhoto).toHaveBeenCalledOnce();
    expect(props.onVisitsChange).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent('Restored 1 visit and 1 photo.');
  });

  it("restores a photo that's missing here, even with no new visits", async () => {
    const withPhoto = makeVisit(1, '2026-11-01', { hasPhoto: true });
    vi.mocked(hasStoredPhoto).mockResolvedValue(false);
    vi.mocked(restorePhoto).mockReset().mockResolvedValue(undefined);
    renderPanel({ visits: [withPhoto] });
    await restoreFrom(
      backupFile({ app: 'spoons_collector', version: 4, visits: [withPhoto], photos: { [withPhoto.id]: 'b2xk' } }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    expect(restorePhoto).toHaveBeenCalledWith(withPhoto.id, 'b2xk');
    expect(screen.getByRole('status')).toHaveTextContent('Restored 0 visits and 1 photo.');
  });

  it("says when a photo couldn't be saved", async () => {
    const added = makeVisit(3, '2026-11-03', { hasPhoto: true });
    vi.mocked(hasStoredPhoto).mockResolvedValue(false);
    vi.mocked(restorePhoto).mockReset().mockRejectedValue(new Error('Disk full'));
    const props = renderPanel();
    await restoreFrom(
      backupFile({ app: 'spoons_collector', version: 4, visits: [added], photos: { [added.id]: 'bmV3' } }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    expect(props.onVisitsChange).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent("Restored 1 visit. 1 photo couldn't be saved on this device.");
  });

  it('says the photos were backed up too', async () => {
    renderPanel({ visits: [makeVisit(1, '2026-11-01', { hasPhoto: true })] });
    await choose('💾 Back up visits');
    expect(screen.getByRole('status')).toHaveTextContent('Backed up 1 visit with photos.');
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

describe('AppMenu notes', () => {
  it('switches photos in backups on and off', async () => {
    const backup = controls();
    renderPanel({ backup });
    await openMenu();
    const photos = screen.getByRole('switch', { name: /Photos in backups/ });
    expect(photos).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(photos);
    expect(backup.toggleIncludePhotos).toHaveBeenCalledOnce();
  });

  it('switches live location on and off, staying open', async () => {
    const props = renderPanel();
    await openMenu();
    const live = screen.getByRole('switch', { name: /Live location/ });
    expect(live).toHaveAttribute('aria-checked', 'false');
    expect(live).toHaveTextContent('Off');
    await userEvent.click(live);
    expect(props.onToggleLiveLocation).toHaveBeenCalledOnce();
    expect(screen.getByRole('switch', { name: /Live location/ })).toBeInTheDocument();
  });

  it('shows live location on', async () => {
    renderPanel({ isLiveLocationOn: true });
    await openMenu();
    const live = screen.getByRole('switch', { name: /Live location/ });
    expect(live).toHaveAttribute('aria-checked', 'true');
    expect(live).toHaveTextContent('On');
  });

  it('credits Wetherspoon for the pub photos', async () => {
    renderPanel();
    await openMenu();
    expect(screen.getByText(/Pub photos © J D Wetherspoon plc/)).toBeInTheDocument();
  });

  afterEach(() => vi.useRealTimers());

  it('shows a success note at the top right that goes by itself', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPanel();
    await choose('💾 Back up visits');
    expect(screen.getByRole('status')).toHaveTextContent('Backed up 2 visits.');
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps an error until dismissed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPanel({ backup: controls({ backUp: vi.fn().mockRejectedValue(new Error('Disk full')) }) });
    await choose('💾 Back up visits');
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't save the backup: Disk full");
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('AppMenu and finished crawls', () => {
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
  it('shows stats, achievements, rarity and regions', () => {
    render(
      <ProgressSection
        locations={samplePubs}
        pubsById={samplePubsById}
        today="2026-11-15"
        visits={visits}
        visitedLocationIds={new Set([1, 2])}
        indexedVisits={{ 1: [visits[0]], 2: [visits[1]] }}
      />,
    );
    for (const heading of ['Your stats', 'Achievements', 'Rarity', 'Regions']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    // Backups live in the ☰ menu now
    expect(screen.queryByRole('heading', { name: 'Your visits' })).not.toBeInTheDocument();
  });

  it('makes every card as tall as the stats card, at least 420px', () => {
    const renderSection = () =>
      render(
        <ProgressSection
          locations={samplePubs}
          pubsById={samplePubsById}
          today="2026-11-15"
          visits={visits}
          visitedLocationIds={new Set([1, 2])}
          indexedVisits={{ 1: [visits[0]], 2: [visits[1]] }}
        />,
      );
    // jsdom measures everything as 0px tall, so the minimum applies
    const { container, unmount } = renderSection();
    expect(container.querySelector<HTMLElement>('.progress-grid')!.style.getPropertyValue('--progress-card-height')).toBe('420px');
    unmount();

    const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')!;
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 610 });
    try {
      const tall = renderSection();
      expect(tall.container.querySelector<HTMLElement>('.progress-grid')!.style.getPropertyValue('--progress-card-height')).toBe('610px');
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', offsetHeight);
    }
  });
});
