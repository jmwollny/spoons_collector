import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CrawlPanel } from './CrawlPanel';
import { makeCrawl, makeVisit, samplePubsById } from '../test/fixtures';
import type { Crawl } from '../crawl';
import type { VisitEntry } from '../types';
import type { StreetRouteStatus } from '../hooks/useCrawlSession';
import { shareText } from '../files';

vi.mock('../files', () => ({ shareText: vi.fn() }));

const renderPanel = ({
  crawl = makeCrawl(),
  indexedVisits = {},
  isFocused = true,
  unlockedNow = [],
  hiddenIds = new Set<number>(),
  streetRouteStatus = 'none',
}: {
  crawl?: Crawl;
  indexedVisits?: Record<number, VisitEntry[]>;
  isFocused?: boolean;
  unlockedNow?: string[];
  hiddenIds?: Set<number>;
  streetRouteStatus?: StreetRouteStatus;
} = {}) => {
  const handlers = {
    onSelectPub: vi.fn(),
    onCheckIn: vi.fn(),
    onShowRoute: vi.fn(),
    onEnd: vi.fn(),
    onFinish: vi.fn(),
    onBrowse: vi.fn(),
    onBackToCrawl: vi.fn(),
    onReveal: vi.fn(),
  };
  render(
    <CrawlPanel
      crawl={crawl}
      pubsById={samplePubsById}
      indexedVisits={indexedVisits}
      isFocused={isFocused}
      unlockedNow={unlockedNow}
      hiddenIds={hiddenIds}
      streetRouteStatus={streetRouteStatus}
      {...handlers}
    />,
  );
  return handlers;
};

const stops = () => screen.getAllByRole('listitem');

describe('CrawlPanel', () => {
  it('sums up the crawl', () => {
    renderPanel();
    const panel = screen.getByRole('region', { name: 'Your Spoons crawl' });
    expect(panel).toHaveTextContent('15 Nov 2026 · from The Cuthbert Brodrick, Leeds');
    expect(panel).toHaveTextContent('2 pubs · 0.1 mi walk · 10:00–12:05 (2 h 5 min) · 2 new');
  });

  it('calls a crawl by car a trip, and leaves out "new" when none are', () => {
    const crawl = makeCrawl({ mode: 'drive' });
    crawl.stops = crawl.stops.map((stop) => ({ ...stop, wasNew: false }));
    renderPanel({ crawl });
    const summary = screen.getByRole('region').querySelectorAll('.crawl-panel-summary')[1];
    expect(summary).toHaveTextContent('0.1 mi trip');
    expect(summary).not.toHaveTextContent('new');
  });

  it('lists the stops in order, with arrival times and meals', () => {
    renderPanel();
    expect(stops()).toHaveLength(2);
    expect(stops()[0]).toHaveTextContent('1The Cuthbert BrodrickLeeds · Common · newStart here · arrive ~10:00Breakfast30 pts');
    expect(stops()[1]).toHaveTextContent('0.1 mi from last stop · arrive ~11:05');
  });

  it('measures the first stop from the start when the crawl starts elsewhere', () => {
    const crawl = makeCrawl({ startIsPub: false, startLabel: 'Leeds' });
    crawl.stops[0] = { ...crawl.stops[0], legMiles: 0.3 };
    renderPanel({ crawl });
    expect(stops()[0]).toHaveTextContent('0.3 mi from start');
  });

  it('highlights the next stop and ticks off visited ones', () => {
    renderPanel({ indexedVisits: { 1: [makeVisit(1, '2026-11-15')] } });
    expect(stops()[0]).toHaveClass('is-done');
    expect(within(stops()[0]).getByText('✓')).toBeInTheDocument();
    expect(within(stops()[0]).queryByRole('button', { name: 'Check in' })).not.toBeInTheDocument();
    expect(stops()[1]).toHaveClass('is-next');
    expect(screen.getByRole('progressbar', { name: 'Pubs visited' })).toHaveAttribute('aria-valuenow', '1');
  });

  it("doesn't count visits from before the crawl", () => {
    renderPanel({ indexedVisits: { 1: [makeVisit(1, '2026-11-01')] } });
    expect(stops()[0]).not.toHaveClass('is-done');
  });

  it('checks in at, or shows, a stop', async () => {
    const handlers = renderPanel();
    await userEvent.click(within(stops()[1]).getByRole('button', { name: 'Check in' }));
    expect(handlers.onCheckIn).toHaveBeenCalledWith(2);
    await userEvent.click(within(stops()[1]).getByText('The Hedley Verity'));
    expect(handlers.onSelectPub).toHaveBeenCalledWith(2);
  });

  it('in crawl mode, offers browsing, the route and ending', async () => {
    const handlers = renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Browse all pubs' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show route' }));
    await userEvent.click(screen.getByRole('button', { name: 'End' }));
    expect(handlers.onBrowse).toHaveBeenCalledOnce();
    expect(handlers.onShowRoute).toHaveBeenCalledOnce();
    expect(handlers.onEnd).toHaveBeenCalledOnce();
  });

  it('while browsing, offers going back to the crawl', async () => {
    const handlers = renderPanel({ isFocused: false });
    expect(screen.queryByRole('button', { name: 'Browse all pubs' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to crawl' }));
    expect(handlers.onBackToCrawl).toHaveBeenCalledOnce();
  });

  it('warns about late arrivals and crawls past 2am', () => {
    const crawl = makeCrawl();
    crawl.stops[1] = { ...crawl.stops[1], arrive: 26 * 60 };
    renderPanel({ crawl });
    expect(stops()[1]).toHaveTextContent("arrive ~02:00 next day (late: check it's open)");
    expect(screen.getByText(/runs past 2am/)).toBeInTheDocument();
    expect(screen.getByText(/Most Wetherspoons close between 11pm and 1am/)).toBeInTheDocument();
  });

  it('skips stops whose pub has gone', () => {
    const crawl = makeCrawl();
    crawl.stops.push({ pubId: 999, legMiles: 1, arrive: 800, meal: null, wasNew: true });
    renderPanel({ crawl });
    expect(stops()).toHaveLength(2);
  });

  describe('once every stop is visited', () => {
    const allVisited = {
      1: [makeVisit(1, '2026-11-15')],
      2: [makeVisit(2, '2026-11-15')],
    };

    it('celebrates, with the numbers and what it unlocked', async () => {
      const crawl = makeCrawl({ unlockedAtStart: ['First Pint'] });
      const handlers = renderPanel({
        crawl,
        indexedVisits: allVisited,
        unlockedNow: ['First Pint', 'Regular'],
      });
      const summary = screen.getByRole('status');
      expect(summary).toHaveTextContent('🎉 Crawl complete! 70 points');
      expect(summary).toHaveTextContent('Pubs2Distance0.1 miNew to you2');
      expect(summary).toHaveTextContent('🏅 Unlocked: Regular');
      expect(screen.queryByRole('button', { name: 'End' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Finish crawl' }));
      expect(handlers.onFinish).toHaveBeenCalledOnce();
    });

    it("doesn't list achievements for an older crawl that didn't record them", () => {
      renderPanel({ indexedVisits: allVisited, unlockedNow: ['First Pint'] });
      expect(screen.getByRole('status')).not.toHaveTextContent('Unlocked');
    });
  });

  describe('scores', () => {
    it('shows the score so far, and points for each stop', () => {
      renderPanel({ indexedVisits: { 1: [makeVisit(1, '2026-11-15')] } });
      expect(screen.getByText('Score: 30')).toBeInTheDocument();
      expect(within(stops()[0]).getByText('30 pts')).toHaveClass('is-earned');
      expect(within(stops()[1]).getByText('40 pts')).not.toHaveClass('is-earned');
    });
  });

  describe('treasure hunts', () => {
    const hunt = makeCrawl({ treasureHunt: true });

    it('hides stops not yet found behind a clue', () => {
      renderPanel({ crawl: hunt, hiddenIds: new Set([2]) });
      expect(screen.getByRole('heading', { name: 'Your Spoons treasure hunt' })).toBeInTheDocument();
      const hidden = stops()[1];
      expect(hidden).toHaveClass('is-hidden');
      expect(within(hidden).getByText('Mystery stop')).toBeInTheDocument();
      expect(hidden).not.toHaveTextContent('Hedley Verity');
      expect(hidden.querySelector('q')).toHaveTextContent('A uncommon Wetherspoon in Yorkshire and The Humber.');
      expect(within(hidden).getByRole('button', { name: "I'm here" })).toBeInTheDocument();
      // A hidden stop can't be shown on the map
      expect(within(hidden).queryByRole('button', { name: /Hedley/ })).not.toBeInTheDocument();
      expect(screen.getByText(/Found stops score half as much again/)).toBeInTheDocument();
    });

    it('reveals a stop, or checks in on arriving', async () => {
      const handlers = renderPanel({ crawl: hunt, hiddenIds: new Set([2]) });
      await userEvent.click(within(stops()[1]).getByRole('button', { name: 'Reveal' }));
      expect(handlers.onReveal).toHaveBeenCalledWith(2);
      await userEvent.click(within(stops()[1]).getByRole('button', { name: "I'm here" }));
      expect(handlers.onCheckIn).toHaveBeenCalledWith(2);
    });
  });

  describe('sharing', () => {
    it('shares an invitation with the crawl code', async () => {
      vi.mocked(shareText).mockResolvedValue('shared');
      renderPanel();
      await userEvent.click(screen.getByRole('button', { name: 'Share' }));
      expect(shareText).toHaveBeenCalledWith(expect.stringMatching(/Join my Spoons crawl.*\n.*SC1\./s), 'Join my Spoons crawl');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('says when the invitation was copied instead, or failed', async () => {
      vi.mocked(shareText).mockResolvedValueOnce('copied').mockRejectedValueOnce(new Error('No clipboard'));
      renderPanel();
      await userEvent.click(screen.getByRole('button', { name: 'Share' }));
      expect(await screen.findByRole('status')).toHaveTextContent('Copied the invitation');
      await userEvent.click(screen.getByRole('button', { name: 'Share' }));
      expect(await screen.findByRole('status')).toHaveTextContent("Couldn't share: No clipboard");
    });
  });

  it('says whether distances follow the streets', () => {
    for (const [status, text] of [
      ['none', 'as the crow flies'],
      ['loading', 'Finding the route along the streets'],
      ['done', 'follow the streets'],
      ['failed', "Couldn't get the route along the streets"],
    ] as const) {
      renderPanel({ streetRouteStatus: status });
      expect(screen.getByText(new RegExp(text))).toBeInTheDocument();
      cleanup();
    }
  });
});
