import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CrawlPlanner } from './CrawlPlanner';
import { leeds1, samplePubs } from '../test/fixtures';
import { getCurrentLocation } from '../location';

vi.mock('../location', () => ({ getCurrentLocation: vi.fn() }));

const renderPlanner = (overrides: Partial<React.ComponentProps<typeof CrawlPlanner>> = {}) => {
  const props = {
    locations: samplePubs,
    visitedIds: new Set<number>(),
    selectedPub: leeds1,
    today: '2026-11-15',
    hasCrawl: false,
    onPlan: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<CrawlPlanner {...props} />);
  return props;
};

const plan = () => userEvent.click(screen.getByRole('button', { name: 'Plan my crawl' }));

describe('CrawlPlanner', () => {
  // Braces matter: a function returned from beforeEach runs as a clean-up
  beforeEach(() => {
    vi.mocked(getCurrentLocation).mockReset();
  });

  it('plans a crawl from the selected pub with the defaults', async () => {
    const props = renderPlanner();
    expect(screen.getByRole('dialog', { name: 'Plan a Spoons crawl' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /The Cuthbert Brodrick, Leeds/ })).toBeChecked();
    await plan();
    const crawl = vi.mocked(props.onPlan).mock.calls[0][0];
    expect(crawl.startIsPub).toBe(true);
    expect(crawl.stops).toHaveLength(4);
    expect(crawl.stops[0].pubId).toBe(1);
    expect(crawl.stops[0].arrive).toBe(10 * 60);
    expect(crawl.mode).toBe('walk');
    expect(crawl.stayMinutes).toBe(60);
    expect(crawl.date).toBe('2026-11-15');
  });

  it('plans with the options chosen', async () => {
    const props = renderPlanner();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Pubs' }), '2');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Which pubs' }), 'rarity');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Getting around' }), 'drive');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Time at each pub' }), '90');
    const time = screen.getByLabelText('Start time');
    await userEvent.clear(time);
    await userEvent.type(time, '18:30');
    await plan();
    const crawl = vi.mocked(props.onPlan).mock.calls[0][0];
    expect(crawl.stops).toHaveLength(2);
    expect(crawl.style).toBe('rarity');
    expect(crawl.mode).toBe('drive');
    expect(crawl.stayMinutes).toBe(90);
    expect(crawl.stops[0].arrive).toBe(18 * 60 + 30);
  });

  it('labels the time at each pub sensibly', () => {
    renderPlanner();
    const stay = screen.getByRole('combobox', { name: 'Time at each pub' });
    expect([...stay.querySelectorAll('option')].map((option) => option.textContent)).toEqual([
      '45 min',
      '1 hour',
      '1.5 hours',
      '2 hours',
    ]);
  });

  it('starts from a town, suggesting the towns with a Spoons', async () => {
    const props = renderPlanner();
    expect(screen.queryByRole('combobox', { name: 'Town' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'A town' }));
    const town = screen.getByRole('combobox', { name: 'Town' });
    expect(town).toHaveValue('Leeds');
    const suggestions = document.getElementById(town.getAttribute('list')!)!;
    expect([...suggestions.querySelectorAll('option')].map((option) => option.value)).toEqual([
      'Glasgow',
      'Leeds',
      'York',
    ]);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Pubs' }), '2');
    await plan();
    expect(vi.mocked(props.onPlan).mock.calls[0][0].startLabel).toBe('Leeds');
  });

  it("says so when the town has no Spoons, and doesn't plan", async () => {
    const props = renderPlanner();
    await userEvent.click(screen.getByRole('radio', { name: 'A town' }));
    const town = screen.getByRole('combobox', { name: 'Town' });
    await userEvent.clear(town);
    await userEvent.type(town, 'Atlantis');
    await plan();
    expect(screen.getByRole('alert')).toHaveTextContent('There are no Wetherspoons in "Atlantis"');
    expect(props.onPlan).not.toHaveBeenCalled();
  });

  it("starts from the user's location", async () => {
    vi.mocked(getCurrentLocation).mockResolvedValue({ lat: 53.96, lon: -1.08 });
    const props = renderPlanner();
    await userEvent.click(screen.getByRole('radio', { name: 'My location' }));
    await plan();
    const crawl = vi.mocked(props.onPlan).mock.calls[0][0];
    expect(crawl.startIsPub).toBe(false);
    expect(crawl.startLabel).toBe('your location');
    // York's pub is nearest
    expect(crawl.stops[0].pubId).toBe(3);
  });

  it("says so when the user can't be found", async () => {
    vi.mocked(getCurrentLocation).mockRejectedValue(new Error('Location access is blocked.'));
    const props = renderPlanner();
    await userEvent.click(screen.getByRole('radio', { name: 'My location' }));
    await plan();
    expect(screen.getByRole('alert')).toHaveTextContent('Location access is blocked.');
    expect(props.onPlan).not.toHaveBeenCalled();
  });

  it('shows Planning… while it works', async () => {
    let finish: (value: { lat: number; lon: number }) => void = () => {};
    vi.mocked(getCurrentLocation).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderPlanner();
    await userEvent.click(screen.getByRole('radio', { name: 'My location' }));
    await plan();
    expect(screen.getByRole('button', { name: 'Planning…' })).toBeDisabled();
    finish({ lat: 53.96, lon: -1.08 });
    expect(await screen.findByRole('button', { name: 'Plan my crawl' })).toBeEnabled();
  });

  it('notes driving, and replacing a crawl under way', async () => {
    renderPlanner({ hasCrawl: true });
    expect(screen.getByText(/This replaces your current crawl/)).toBeInTheDocument();
    expect(screen.queryByText(/drink and drive/)).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Getting around' }), 'drive');
    expect(screen.getByText(/Please don't drink and drive/)).toBeInTheDocument();
  });

  it('explains when there are too few unvisited pubs', async () => {
    const props = renderPlanner({ visitedIds: new Set([2, 3, 4]) });
    await plan();
    expect(screen.getByRole('alert')).toHaveTextContent("aren't enough pubs you haven't visited");
    expect(props.onPlan).not.toHaveBeenCalled();
  });

  it('closes', async () => {
    const props = renderPlanner();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });
});
