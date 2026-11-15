import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatsPanel } from './StatsPanel';
import { MonthChart } from './stats/MonthChart';
import { makeVisit, samplePubsById } from '../test/fixtures';
import { monthlyVisits } from '../stats';
import { shareFile } from '../files';
import { drawYearCard } from './stats/yearCardImage';

vi.mock('../files', () => ({ shareFile: vi.fn() }));
vi.mock('./stats/yearCardImage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./stats/yearCardImage')>()),
  drawYearCard: vi.fn(),
}));

const visits = [
  makeVisit(1, '2025-12-20', { id: 'a', rating: 2, drink: 'Abbot Ale' }),
  makeVisit(1, '2026-11-02', { id: 'b', rating: 0 }),
  makeVisit(2, '2026-11-09', { id: 'c', rating: 2, drink: 'abbot ale' }),
  makeVisit(4, '2026-11-14', { id: 'd', rating: -1 }),
];

const fact = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling;

beforeEach(() => {
  vi.mocked(shareFile).mockReset();
  vi.mocked(drawYearCard).mockReset();
});

describe('StatsPanel', () => {
  it('asks for a visit before there are any', () => {
    render(<StatsPanel visits={[]} pubsById={samplePubsById} today="2026-11-15" />);
    expect(screen.getByText('Log a visit to see your stats.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Year in Spoons/ })).not.toBeInTheDocument();
  });

  it('shows the headline numbers', () => {
    render(<StatsPanel visits={visits} pubsById={samplePubsById} today="2026-11-15" />);
    expect(fact('Visits')).toHaveTextContent('4');
    expect(fact('Pubs')).toHaveTextContent('3');
    // 3, 1 and 3 stars; the unrated visit doesn't count
    expect(fact('Average')).toHaveTextContent('2.3 ★');
  });

  it('shows best year, streak, favourite, most remote and furthest flung', () => {
    render(<StatsPanel visits={visits} pubsById={samplePubsById} today="2026-11-15" />);
    expect(fact('Best year')).toHaveTextContent('2026: 3 pubs');
    // Weeks of 2 and 9 November; 20 December is too long before
    expect(fact('Weekly streak')).toHaveTextContent('2 weeks now, best 2 weeks');
    expect(fact('Favourite')).toHaveTextContent('The Cuthbert Brodrick (2 visits)');
    expect(fact('Most remote')).toHaveTextContent('The Counting House (Legendary)');
    expect(fact('Furthest flung')).toHaveTextContent(/^The Counting House, \d+ mi from your usual patch$/);
  });

  it('opens the Year in Spoons for the latest year, and closes it', async () => {
    render(<StatsPanel visits={visits} pubsById={samplePubsById} today="2026-11-15" />);
    await userEvent.click(screen.getByRole('button', { name: '🎉 Year in Spoons' }));
    const card = screen.getByRole('article', { name: 'My 2026 in Spoons' });
    const number = (label: string) => within(card).getByText(label).nextElementSibling;
    expect(number('pubs')).toHaveTextContent('3');
    expect(number('visits')).toHaveTextContent('3');
    // The Cuthbert Brodrick was first visited in 2025
    expect(number('new to me')).toHaveTextContent('2');
    expect(within(card).getByText('Drink of the year').nextElementSibling).toHaveTextContent('abbot ale');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('switches between years', async () => {
    render(<StatsPanel visits={visits} pubsById={samplePubsById} today="2026-11-15" />);
    await userEvent.click(screen.getByRole('button', { name: '🎉 Year in Spoons' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Year' }), '2025');
    const card = screen.getByRole('article', { name: 'My 2025 in Spoons' });
    expect(within(card).getByText('pub').nextElementSibling).toHaveTextContent('1');
    expect(within(card).getByText('region').nextElementSibling).toHaveTextContent('1');
    expect(within(card).getByText('Best month').nextElementSibling).toHaveTextContent('Dec: 1 visit');
  });

  it('shares the card as an image', async () => {
    const image = new Blob(['png'], { type: 'image/png' });
    vi.mocked(drawYearCard).mockResolvedValue(image);
    vi.mocked(shareFile).mockResolvedValue('shared');
    render(<StatsPanel visits={visits} pubsById={samplePubsById} today="2026-11-15" />);
    await userEvent.click(screen.getByRole('button', { name: '🎉 Year in Spoons' }));
    await userEvent.click(screen.getByRole('button', { name: 'Share as an image' }));
    expect(drawYearCard).toHaveBeenCalledWith(expect.objectContaining({ year: 2026, pubs: 3 }));
    expect(shareFile).toHaveBeenCalledWith(image, 'year-in-spoons-2026.png', 'My 2026 in Spoons');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says where a downloaded image went, or why it failed', async () => {
    vi.mocked(drawYearCard).mockResolvedValue(new Blob(['png']));
    vi.mocked(shareFile).mockResolvedValueOnce('downloaded').mockRejectedValueOnce(new Error('No apps'));
    render(<StatsPanel visits={visits} pubsById={samplePubsById} today="2026-11-15" />);
    await userEvent.click(screen.getByRole('button', { name: '🎉 Year in Spoons' }));
    await userEvent.click(screen.getByRole('button', { name: 'Share as an image' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Saved the image to your downloads.');
    await userEvent.click(screen.getByRole('button', { name: 'Share as an image' }));
    expect(await screen.findByRole('status')).toHaveTextContent("Couldn't share: No apps");
  });

  it("says so when the image can't be made", async () => {
    vi.mocked(drawYearCard).mockResolvedValue(null);
    render(<StatsPanel visits={visits} pubsById={samplePubsById} today="2026-11-15" />);
    await userEvent.click(screen.getByRole('button', { name: '🎉 Year in Spoons' }));
    await userEvent.click(screen.getByRole('button', { name: 'Share as an image' }));
    expect(await screen.findByRole('status')).toHaveTextContent("Couldn't make the image on this device.");
    expect(shareFile).not.toHaveBeenCalled();
  });
});

describe('MonthChart', () => {
  const months = monthlyVisits(visits, '2026-11-15');

  it('draws a column per month, the busiest labelled', () => {
    const { container } = render(<MonthChart months={months} />);
    const bars = container.querySelectorAll<HTMLElement>('.month-chart-bar');
    expect(bars).toHaveLength(12);
    expect(bars[11].style.height).toBe('100%');
    // December: 1 visit against November's 3
    expect(bars[0].style.height).toBe(`${(1 / 3) * 100}%`);
    expect(bars[5].style.height).toBe('0%');
    expect(container.querySelector('.month-chart-peak')).toHaveTextContent('3');
  });

  it('gives the numbers to screen readers as a table', () => {
    render(<MonthChart months={months} />);
    const table = screen.getByRole('table', { name: 'Visits per month' });
    expect(within(table).getByRole('row', { name: 'Nov 2026 3 2' })).toBeInTheDocument();
  });

  it("shows a month's numbers on hover or focus", () => {
    const { container } = render(<MonthChart months={months} />);
    const columns = container.querySelectorAll('.month-chart-column');
    fireEvent.mouseEnter(columns[11]);
    expect(container.querySelector('.month-chart-tooltip')).toHaveTextContent('Nov 2026: 3 visits, 2 new pubs');
    fireEvent.mouseLeave(columns[11]);
    fireEvent.focus(columns[0]);
    expect(container.querySelector('.month-chart-tooltip')).toHaveTextContent('Dec 2025: 1 visit, 1 new pub');
    fireEvent.blur(columns[0]);
    expect(container.querySelector('.month-chart-tooltip')?.textContent?.trim()).toBe('');
  });

  it('copes with a year of no visits', () => {
    const { container } = render(<MonthChart months={monthlyVisits([], '2026-11-15')} />);
    expect(container.querySelector('.month-chart-peak')).toBeNull();
  });
});
