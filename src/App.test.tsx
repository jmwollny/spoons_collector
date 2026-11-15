import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { buildPubData } from './data';
import { samplePubs } from './test/fixtures';
import { resetFakeMap } from './test/leafletStub';
import { setMediaQueryMatches, stubLayout } from './test/browser';
import { getCurrentLocation } from './location';
import { encodeCrawl } from './crawlShare';
import { makeCrawl } from './test/fixtures';

vi.mock('react-leaflet', () => import('./test/leafletStub'));
vi.mock('react-leaflet-cluster', () =>
  import('./test/leafletStub').then((module) => ({ default: module.MarkerClusterGroup })),
);
vi.mock('./location', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./location')>()),
  getCurrentLocation: vi.fn(),
}));

// Photos and street routes, without IndexedDB or the network
vi.mock('./photos', () => ({
  savePhoto: vi.fn(async () => {}),
  deletePhoto: vi.fn(async () => {}),
  loadPhotoUrl: vi.fn(async () => 'blob:photo'),
  shrinkPhoto: vi.fn(async (photo: Blob) => photo),
}));
vi.mock('./streetRoute', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./streetRoute')>()),
  fetchStreetRoute: vi.fn(async () => {
    throw new Error('offline');
  }),
}));

// Live location, controlled by the tests
const live = vi.hoisted(() => ({ arrivedPubId: null as number | null }));
vi.mock('./liveLocation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./liveLocation')>()),
  useLiveLocation: (on: boolean) => ({ position: on ? { lat: 53.8, lon: -1.55, accuracy: 10 } : null, error: null }),
  useArrival: () => live.arrivedPubId,
}));

// The data as the pipeline writes it, keyed on OSM ids
const data = buildPubData(samplePubs.map((pub) => ({ ...pub, id: pub.osmId, jdwId: pub.id })));

let restoreLayout: () => void;
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 15, 12));
  restoreLayout = stubLayout({ width: 1000, height: 3000, rowHeight: 300 });
  setMediaQueryMatches(() => false);
  resetFakeMap();
  live.arrivedPubId = null;
  vi.mocked(getCurrentLocation).mockReset();
});
afterEach(() => {
  restoreLayout();
  vi.useRealTimers();
});

const renderApp = () => {
  render(<App data={data} />);
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
};

// The pub list (the stand-in map markers share the cards' names)
const list = () => document.querySelector<HTMLElement>('.collection-gallery-card');
const listCards = () => {
  const element = list();
  return element ? within(element).queryAllByRole('button', { name: /^The .+, \w+$/ }) : [];
};
const listCard = (name: string) => within(list()!).getByRole('button', { name });
const summary = () => document.querySelector('.selected-visit-details')!;
const metric = (label: string) => screen.getByText(label).previousElementSibling!;

/** Adds a visit to the selected pub through the Add visit form */
const addVisit = async (user: ReturnType<typeof userEvent.setup>, stars = 2) => {
  await user.click(screen.getByRole('button', { name: 'Add visit' }));
  const form = screen.getByRole('dialog', { name: 'Add visit' });
  await user.click(within(form).getByRole('button', { name: `Rate ${stars} out of 3` }));
  await user.click(within(form).getByRole('button', { name: 'Save visit' }));
};

describe('App', () => {
  it('shows the map, the list of pubs and progress', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: 'Spoons Collector' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Showing 4 Wetherspoon pubs' })).toBeInTheDocument();
    expect(listCards()).toHaveLength(4);
    expect(screen.getAllByTestId('marker')).toHaveLength(4);
    expect(metric('Visited Spoons')).toHaveTextContent('0');
    expect(screen.getByRole('heading', { name: 'Achievements' })).toBeInTheDocument();
    expect(summary()).toHaveTextContent('The Cuthbert Brodrick·Not visited yet');
  });

  it('logs a visit, updating the summary, counters and achievements', async () => {
    const user = renderApp();
    await addVisit(user, 3);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(summary()).toHaveTextContent('15 Nov 2026');
    expect(within(summary() as HTMLElement).getByRole('img', { name: 'Rated 3 out of 3' })).toBeInTheDocument();
    expect(metric('Visited Spoons')).toHaveTextContent('1');
    expect(metric('Completion')).toHaveTextContent('25%');
    expect(screen.getByText('First Pint').closest('li')).toHaveClass('unlocked');
    expect(JSON.parse(window.localStorage.getItem('spoons-collector-v2')!)).toHaveLength(1);
  });

  it('opens a pub from the list full size, and adds a visit from there', async () => {
    const user = renderApp();
    await user.click(listCard('The Punch Bowl, York'));
    const viewer = screen.getByRole('dialog', { name: 'The Punch Bowl' });
    await user.click(within(viewer).getByRole('button', { name: '+ Add visit' }));
    expect(screen.queryByRole('dialog', { name: 'The Punch Bowl' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save visit' }));
    expect(summary()).toHaveTextContent('The Punch Bowl');
    expect(summary()).toHaveTextContent('15 Nov 2026');
  });

  it('steps through nearby pubs from the card viewer', async () => {
    const user = renderApp();
    await user.click(listCard('The Cuthbert Brodrick, Leeds'));
    const viewer = screen.getByRole('dialog', { name: 'The Cuthbert Brodrick' });
    await user.click(within(viewer).getByRole('button', { name: /^Next: The Hedley Verity/ }));
    expect(screen.getByRole('dialog', { name: 'The Hedley Verity' })).toBeInTheDocument();
    expect(summary()).toHaveTextContent('The Hedley Verity');
  });

  it('edits and deletes visits from the visit list', async () => {
    const user = renderApp();
    await addVisit(user, 1);
    await user.click(screen.getByRole('button', { name: 'Visits (1)' }));
    const history = screen.getByRole('dialog', { name: 'Visits to The Cuthbert Brodrick' });
    await user.click(within(history).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('dialog', { name: 'Edit visit' });
    await user.click(within(form).getByRole('button', { name: 'Rate 3 out of 3' }));
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));
    expect(within(summary() as HTMLElement).getByRole('img', { name: 'Rated 3 out of 3' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Visits (1)' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete visit' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(summary()).toHaveTextContent('Not visited yet');
    expect(screen.getByRole('button', { name: 'Visits (0)' })).toBeDisabled();
  });

  it('filters the list and the map together', async () => {
    const user = renderApp();
    await user.type(screen.getByRole('searchbox', { name: 'Search pub or city' }), 'leeds');
    expect(screen.getByRole('heading', { name: 'Showing 2 Wetherspoon pubs' })).toBeInTheDocument();
    expect(screen.getAllByTestId('marker')).toHaveLength(2);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Visited or not' }), 'visited');
    expect(screen.getByRole('heading', { name: 'Showing 0 Wetherspoon pubs' })).toBeInTheDocument();
  });

  it('Near me selects the nearest unvisited pub and sorts by distance', async () => {
    vi.mocked(getCurrentLocation).mockResolvedValue({ lat: 53.96, lon: -1.08 });
    const user = renderApp();
    await user.click(screen.getByRole('button', { name: '📍 Near me' }));
    await waitFor(() => expect(summary()).toHaveTextContent('The Punch Bowl'));
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveValue('distance');
    expect(screen.getByRole('combobox', { name: 'Visited or not' })).toHaveValue('unvisited');
    expect(listCards()[0]).toHaveAccessibleName('The Punch Bowl, York');
  });

  it('expands the map to full screen and back', async () => {
    const user = renderApp();
    await user.click(screen.getByRole('button', { name: 'Expand map to full screen' }));
    expect(document.querySelector('.map-viewport-wrapper')).toHaveClass('is-expanded');
    await user.keyboard('{Escape}');
    expect(document.querySelector('.map-viewport-wrapper')).not.toHaveClass('is-expanded');
  });

  describe('crawls', () => {
    const planCrawl = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole('button', { name: /Plan a crawl/ }));
      const planner = screen.getByRole('dialog', { name: 'Plan a Spoons crawl' });
      await user.selectOptions(within(planner).getByRole('combobox', { name: 'Pubs' }), '2');
      await user.click(within(planner).getByRole('button', { name: 'Plan my crawl' }));
    };

    it('plans a crawl and switches to crawl mode', async () => {
      const user = renderApp();
      await planCrawl(user);
      expect(screen.getByRole('region', { name: 'Your Spoons crawl' })).toBeInTheDocument();
      expect(document.querySelector('.app-shell')).toHaveClass('is-crawl-mode');
      expect(listCards()).toHaveLength(0);
      expect(screen.queryByRole('heading', { name: 'Achievements' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Plan a crawl/ })).toBeDisabled();
      expect(screen.getAllByRole('button', { name: /^\d\. / })).toHaveLength(2);
    });

    it('checks in at each stop until the crawl is complete', async () => {
      const user = renderApp();
      await planCrawl(user);
      const panel = screen.getByRole('region', { name: 'Your Spoons crawl' });
      for (let stop = 0; stop < 2; stop++) {
        await user.click(within(panel).getAllByRole('button', { name: 'Check in' })[0]);
        await user.click(screen.getByRole('button', { name: 'Save visit' }));
      }
      expect(within(panel).getByRole('status')).toHaveTextContent('🎉 Crawl complete!');
      expect(within(panel).getByRole('status')).toHaveTextContent('Unlocked: First Pint');
      await user.click(within(panel).getByRole('button', { name: 'Finish crawl' }));
      expect(screen.queryByRole('region', { name: 'Your Spoons crawl' })).not.toBeInTheDocument();
      expect(listCards()).toHaveLength(4);
    });

    it('browses all pubs mid-crawl, and goes back', async () => {
      const user = renderApp();
      await planCrawl(user);
      await user.click(screen.getByRole('button', { name: 'Browse all pubs' }));
      expect(listCards()).toHaveLength(4);
      expect(screen.getByRole('button', { name: /Plan a crawl/ })).toBeEnabled();
      await user.click(screen.getByRole('button', { name: 'Back to crawl' }));
      expect(listCards()).toHaveLength(0);
    });

    it('ends a crawl after asking', async () => {
      const user = renderApp();
      await planCrawl(user);
      await user.click(screen.getByRole('button', { name: 'End' }));
      await user.click(screen.getByRole('button', { name: 'End crawl' }));
      expect(screen.queryByRole('region', { name: 'Your Spoons crawl' })).not.toBeInTheDocument();
      expect(window.localStorage.getItem('spoons-collector-crawl-v1')).toBeNull();
    });
  });

  it('with live location on, offers to check in at the pub the user reaches', async () => {
    const user = renderApp();
    await user.click(screen.getByRole('button', { name: /Live location: Off/ }));
    expect(screen.getByRole('button', { name: /Live location: On/ })).toBeInTheDocument();
    expect(screen.getByTestId('you-are-here')).toBeInTheDocument();
  });

  it('shows the banner for a pub reached, and checks in from it', async () => {
    window.localStorage.setItem('spoons-collector-live-location', 'on');
    live.arrivedPubId = 2;
    const user = renderApp();
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent("You're atThe Hedley Verity");
    // The user hadn't picked a pub, so it's selected for them
    expect(summary()).toHaveTextContent('The Hedley Verity');
    await user.click(within(banner).getByRole('button', { name: 'Check in' }));
    await user.click(screen.getByRole('button', { name: 'Save visit' }));
    // Checked in today, so the banner goes
    expect(screen.queryByText("You're at")).not.toBeInTheDocument();
  });

  it('reminds the user to back up once they have a few visits', async () => {
    const user = renderApp();
    for (const name of ['The Cuthbert Brodrick, Leeds', 'The Hedley Verity, Leeds', 'The Punch Bowl, York']) {
      await user.click(listCard(name));
      await user.click(screen.getByRole('button', { name: '+ Add visit' }));
      await user.click(screen.getByRole('button', { name: 'Save visit' }));
    }
    expect(screen.getByText(/Your 3 visits aren't backed up/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByText(/aren't backed up/)).not.toBeInTheDocument();
  });

  describe('smaller paths', () => {
    it('from the full-size card, shows the visits or the map', async () => {
      const user = renderApp();
      await addVisit(user);
      await user.click(listCard('The Cuthbert Brodrick, Leeds'));
      await user.click(screen.getByRole('button', { name: '1 visit' }));
      expect(screen.getByRole('dialog', { name: 'Visits to The Cuthbert Brodrick' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Add another visit' }));
      expect(screen.getByRole('dialog', { name: 'Add visit' })).toBeInTheDocument();
      await user.keyboard('{Escape}');

      await user.click(listCard('The Hedley Verity, Leeds'));
      await user.click(screen.getByRole('button', { name: '🗺 Map' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(summary()).toHaveTextContent('The Hedley Verity');
    });

    it("opens the full-size card from the map's card", async () => {
      const user = renderApp();
      await user.click(document.querySelector('.map-viewport-wrapper .spoon-card.small')!);
      expect(screen.getByRole('dialog', { name: 'The Cuthbert Brodrick' })).toBeInTheDocument();
    });

    it("opens the full-size card from the phone's pub sheet", async () => {
      const user = renderApp();
      await user.click(screen.getByRole('button', { name: 'Open the card for The Cuthbert Brodrick' }));
      expect(screen.getByRole('dialog', { name: 'The Cuthbert Brodrick' })).toBeInTheDocument();
    });

    it('picks another pub in the Add visit form', async () => {
      const user = renderApp();
      await user.click(screen.getByRole('button', { name: 'Add visit' }));
      await user.selectOptions(screen.getByRole('combobox', { name: 'Pub' }), '4');
      await user.click(screen.getByRole('button', { name: 'Save visit' }));
      expect(summary()).toHaveTextContent('The Counting House');
      expect(summary()).toHaveTextContent('15 Nov 2026');
    });

    it('shows or dismisses the arrival banner', async () => {
      window.localStorage.setItem('spoons-collector-live-location', 'on');
      live.arrivedPubId = 3;
      const user = renderApp();
      await user.click(screen.getByText('The Punch Bowl', { selector: '.arrival-banner strong' }));
      expect(summary()).toHaveTextContent('The Punch Bowl');
      await user.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(screen.queryByText("You're at")).not.toBeInTheDocument();
    });

    it("selects crawl stops from the panel, and shows the route", async () => {
      const user = renderApp();
      await user.click(screen.getByRole('button', { name: /Plan a crawl/ }));
      await user.selectOptions(screen.getByRole('combobox', { name: 'Pubs' }), '2');
      await user.click(screen.getByRole('button', { name: 'Plan my crawl' }));
      const panel = screen.getByRole('region', { name: 'Your Spoons crawl' });
      await user.click(within(panel).getByText('The Hedley Verity'));
      expect(summary()).toHaveTextContent('The Hedley Verity');
      await user.click(within(panel).getByRole('button', { name: 'Show route' }));
      expect(screen.getByTestId('line')).toBeInTheDocument();
    });

    it('restores visits and a crawl from a backup file', async () => {
      const user = renderApp();
      const crawl = {
        id: 'crawl-restored',
        date: '2026-11-15',
        style: 'any',
        mode: 'walk',
        stayMinutes: 60,
        startLabel: 'Leeds',
        startLat: 53.8,
        startLon: -1.55,
        startIsPub: false,
        stops: [{ pubId: 2, legMiles: 0.1, arrive: 600, meal: null, wasNew: true }],
      };
      const file = new File(
        [
          JSON.stringify({
            app: 'spoons_collector',
            version: 2,
            visits: [{ id: 'v1', locationId: 3, date: '2026-11-01', rating: 2 }],
            crawl,
          }),
        ],
        'backup.json',
      );
      await user.upload(screen.getByLabelText('Backup file'), file);
      await user.click(await screen.findByRole('button', { name: 'Restore' }));
      expect(JSON.parse(window.localStorage.getItem('spoons-collector-v2')!)).toHaveLength(1);
      // The restored crawl starts crawl mode
      expect(screen.getByRole('region', { name: 'Your Spoons crawl' })).toHaveTextContent('from Leeds');
      expect(document.querySelector('.app-shell')).toHaveClass('is-crawl-mode');
    });

    it("leaves a backup's broken crawl out", async () => {
      const user = renderApp();
      const file = new File(
        [
          JSON.stringify({
            app: 'spoons_collector',
            version: 2,
            visits: [{ id: 'v1', locationId: 3, date: '2026-11-01', rating: 2 }],
            crawl: { id: 'broken' },
          }),
        ],
        'backup.json',
      );
      await user.upload(screen.getByLabelText('Backup file'), file);
      const dialog = await screen.findByRole('alertdialog');
      expect(dialog).not.toHaveTextContent('crawl');
      await user.click(within(dialog).getByRole('button', { name: 'Restore' }));
      expect(metric('Visited Spoons')).toHaveTextContent('1');
      expect(screen.queryByRole('region', { name: 'Your Spoons crawl' })).not.toBeInTheDocument();
    });

    it('cancelling a delete keeps the visit; deleting one of several keeps the list open', async () => {
      const user = renderApp();
      await addVisit(user, 1);
      await addVisit(user, 2);
      await user.click(screen.getByRole('button', { name: 'Visits (2)' }));
      await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      const stillOpen = screen.getByRole('dialog', { name: 'Visits to The Cuthbert Brodrick' });
      expect(within(stillOpen).getAllByRole('button', { name: 'Edit' })).toHaveLength(2);

      await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
      await user.click(screen.getByRole('button', { name: 'Delete visit' }));
      const history = screen.getByRole('dialog', { name: 'Visits to The Cuthbert Brodrick' });
      expect(within(history).getAllByRole('button', { name: 'Edit' })).toHaveLength(1);
      await user.click(within(history).getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Visits (1)' })).toBeEnabled();
    });

    it('after Near me, the full-size card shows how far away the pub is', async () => {
      vi.mocked(getCurrentLocation).mockResolvedValue({ lat: 53.96, lon: -1.08 });
      const user = renderApp();
      await user.click(screen.getByRole('button', { name: '📍 Near me' }));
      await waitFor(() => expect(summary()).toHaveTextContent('The Punch Bowl'));
      await user.click(listCard('The Punch Bowl, York'));
      const viewer = screen.getByRole('dialog', { name: 'The Punch Bowl' });
      expect(within(viewer).getByText('Distance').nextElementSibling).toHaveTextContent('0.1 mi');
    });
  });

  describe('notes, photos and stats', () => {
    it('logs what was drunk, who with, notes and a photo, shown in the visit list', async () => {
      URL.createObjectURL = vi.fn(() => 'blob:preview');
      URL.revokeObjectURL = vi.fn();
      const user = renderApp();
      await user.click(screen.getByRole('button', { name: 'Add visit' }));
      await user.type(screen.getByLabelText('Drink'), 'Abbot Ale');
      await user.type(screen.getByLabelText('Who with'), 'Sam');
      await user.type(screen.getByLabelText('Notes'), 'Quiz night');
      await user.upload(screen.getByLabelText(/Add photo/), new File(['jpeg'], 'pub.jpg', { type: 'image/jpeg' }));
      expect(await screen.findByRole('img', { name: "This visit's photo" })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Save visit' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: 'Visits (1)' }));
      const history = screen.getByRole('dialog', { name: 'Visits to The Cuthbert Brodrick' });
      expect(within(history).getByText('🍺 Abbot Ale · 👥 Sam')).toBeInTheDocument();
      expect(within(history).getByText('Quiz night')).toBeInTheDocument();
      expect(await within(history).findByRole('button', { name: 'Photo from 15 Nov 2026' })).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem('spoons-collector-v2')!)[0]).toMatchObject({
        drink: 'Abbot Ale',
        company: 'Sam',
        notes: 'Quiz night',
        hasPhoto: true,
      });
    });

    it('shows stats once there are visits, and the Year in Spoons', async () => {
      const user = renderApp();
      expect(screen.getByText('Log a visit to see your stats.')).toBeInTheDocument();
      await addVisit(user, 3);
      const stats = screen.getByRole('heading', { name: 'Your stats' }).closest('.card') as HTMLElement;
      expect(within(stats).getByText('Visits', { selector: 'dt' }).nextElementSibling).toHaveTextContent('1');
      await user.click(within(stats).getByRole('button', { name: '🎉 Year in Spoons' }));
      expect(screen.getByRole('article', { name: 'My 2026 in Spoons' })).toBeInTheDocument();
    });
  });

  describe('crawl extras', () => {
    const planWith = async (user: ReturnType<typeof userEvent.setup>, option?: RegExp) => {
      await user.click(screen.getByRole('button', { name: /Plan a crawl/ }));
      const planner = screen.getByRole('dialog', { name: 'Plan a Spoons crawl' });
      await user.selectOptions(within(planner).getByRole('combobox', { name: 'Pubs' }), '2');
      if (option) await user.click(within(planner).getByRole('checkbox', { name: option }));
      await user.click(within(planner).getByRole('button', { name: 'Plan my crawl' }));
    };

    it('plays a treasure hunt: clues, revealing, and scoring', async () => {
      const user = renderApp();
      await planWith(user, /Treasure hunt/);
      const panel = screen.getByRole('region', { name: 'Your Spoons crawl' });
      expect(within(panel).getByRole('heading', { name: 'Your Spoons treasure hunt' })).toBeInTheDocument();
      // The first stop is the pub the crawl starts at; the second is a mystery
      expect(within(panel).getByText('Mystery stop')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '2. The Hedley Verity' })).not.toBeInTheDocument();
      await user.click(within(panel).getByRole('button', { name: 'Reveal' }));
      expect(within(panel).getByText('The Hedley Verity')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '2. The Hedley Verity' })).toBeInTheDocument();
    });

    it("starting a hunt from a town doesn't give the first stop away", async () => {
      const user = renderApp();
      // Select Glasgow, then hunt in Leeds
      await user.click(listCard('The Counting House, Glasgow'));
      await user.keyboard('{Escape}');
      await user.click(screen.getByRole('button', { name: /Plan a crawl/ }));
      const planner = screen.getByRole('dialog', { name: 'Plan a Spoons crawl' });
      await user.click(within(planner).getByRole('radio', { name: 'A town' }));
      const town = within(planner).getByRole('combobox', { name: 'Town' });
      await user.clear(town);
      await user.type(town, 'Leeds');
      await user.selectOptions(within(planner).getByRole('combobox', { name: 'Pubs' }), '2');
      await user.click(within(planner).getByRole('checkbox', { name: /Treasure hunt/ }));
      await user.click(within(planner).getByRole('button', { name: 'Plan my crawl' }));
      expect(screen.getAllByText('Mystery stop')).toHaveLength(2);
      expect(summary()).toHaveTextContent('The Counting House');
      expect(summary()).not.toHaveTextContent(/Cuthbert|Hedley/);
    });

    it('scores a crawl and counts it towards achievements once finished', async () => {
      const user = renderApp();
      // Not following the streets, so no routing is attempted
      await planWith(user, /Follow the streets/);
      const panel = screen.getByRole('region', { name: 'Your Spoons crawl' });
      for (let stop = 0; stop < 2; stop++) {
        await user.click(within(panel).getAllByRole('button', { name: 'Check in' })[0]);
        await user.click(screen.getByRole('button', { name: 'Save visit' }));
      }
      // Both pubs new: Common 10 × 2 + breakfast 10, Uncommon 20 × 2
      expect(within(panel).getByRole('status')).toHaveTextContent('Crawl complete! 70 points');
      expect(within(panel).getByRole('status')).toHaveTextContent('Unlocked: First Pint, Crawler');
      await user.click(within(panel).getByRole('button', { name: 'Finish crawl' }));
      expect(screen.getByText('Crawler').closest('li')).toHaveClass('unlocked');
      expect(JSON.parse(window.localStorage.getItem('spoons-collector-crawl-history-v1')!)).toHaveLength(1);
    });

    it('says when the street route could not be had', async () => {
      const user = renderApp();
      await planWith(user);
      expect(await screen.findByText(/Couldn't get the route along the streets/)).toBeInTheDocument();
    });

    it("joins a friend's crawl from a link, after asking", async () => {
      window.history.replaceState(null, '', `/?crawl=${encodeCrawl(makeCrawl({ startTime: 600 }))}`);
      const user = renderApp();
      const dialog = screen.getByRole('alertdialog', { name: 'Join this crawl?' });
      expect(dialog).toHaveTextContent('2 pubs from The Cuthbert Brodrick, Leeds on 15 Nov 2026.');
      await user.click(within(dialog).getByRole('button', { name: 'Join crawl' }));
      expect(screen.getByRole('region', { name: 'Your Spoons crawl' })).toBeInTheDocument();
      expect(window.location.search).toBe('');
    });

    it("says when a link's crawl can't be opened", async () => {
      window.history.replaceState(null, '', '/?crawl=SC1.broken');
      const user = renderApp();
      const dialog = screen.getByRole('alertdialog', { name: "Couldn't open that crawl" });
      expect(dialog).toHaveTextContent('damaged');
      await user.click(within(dialog).getByRole('button', { name: 'OK' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });
});
