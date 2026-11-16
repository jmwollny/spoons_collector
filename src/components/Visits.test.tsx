import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Visits } from './Visits';
import { PubFilters } from './PubFilters';
import { GalleryCard } from './GalleryCard';
import { leeds1, makeVisit, samplePubs } from '../test/fixtures';
import { setMediaQueryMatches, stubLayout } from '../test/browser';

describe('GalleryCard', () => {
  it('shows the pub as a card and opens it when clicked', async () => {
    const onOpen = vi.fn();
    render(
      <GalleryCard
        pub={leeds1}
        visits={[makeVisit(1, '2026-11-14', { rating: 2 })]}
        isSelected={true}
        distanceMiles={1.24}
        onOpen={onOpen}
      />,
    );
    const button = screen.getByRole('button', { name: 'The Cuthbert Brodrick, Leeds' });
    expect(button.querySelector('.spoon-card')).toHaveClass('medium', 'selected');
    expect(button).toHaveTextContent('14 Nov 2026');
    expect(button).toHaveTextContent('1.2 mi');
    await userEvent.click(button);
    expect(onOpen).toHaveBeenCalledWith(1);
  });

  it('for an unvisited pub, shows it as not visited', () => {
    render(<GalleryCard pub={leeds1} visits={[]} isSelected={false} onOpen={vi.fn()} />);
    const card = screen.getByRole('button').querySelector('.spoon-card');
    expect(card).toHaveClass('unvisited');
    expect(card).not.toHaveClass('selected');
    expect(card).toHaveTextContent('Not visited');
  });
});

const filterProps = () => ({
  count: 4,
  searchTerm: '',
  onSearchChange: vi.fn(),
  regions: ['Scotland', 'Wales'],
  selectedRegion: 'all',
  onRegionChange: vi.fn(),
  visitFilter: 'all' as const,
  onVisitFilterChange: vi.fn(),
  onNearMe: vi.fn(),
  locating: false,
  locationError: null as string | null,
});

describe('PubFilters', () => {
  it('searches and filters', async () => {
    const props = filterProps();
    render(<PubFilters {...props} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search pub or city' }), 'L');
    expect(props.onSearchChange).toHaveBeenCalledWith('L');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Region' }), 'Wales');
    expect(props.onRegionChange).toHaveBeenCalledWith('Wales');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Visited or not' }), 'unvisited');
    expect(props.onVisitFilterChange).toHaveBeenCalledWith('unvisited');
  });

  it('counts the pubs chosen, saying "pub" for one', () => {
    const { rerender } = render(<PubFilters {...filterProps()} />);
    expect(screen.getByRole('heading', { name: 'Showing 4 Wetherspoon pubs' })).toBeInTheDocument();
    rerender(<PubFilters {...filterProps()} count={1} />);
    expect(screen.getByRole('heading', { name: 'Showing 1 Wetherspoon pub' })).toBeInTheDocument();
  });

  it('offers every region, and all of them', () => {
    render(<PubFilters {...filterProps()} />);
    const regions = screen.getByRole('combobox', { name: 'Region' });
    expect([...regions.querySelectorAll('option')].map((option) => option.textContent)).toEqual([
      'All regions',
      'Scotland',
      'Wales',
    ]);
  });

  it('finds the user, and shows when it is', async () => {
    const props = filterProps();
    const { rerender } = render(<PubFilters {...props} />);
    await userEvent.click(screen.getByRole('button', { name: '📍 Near me' }));
    expect(props.onNearMe).toHaveBeenCalledOnce();
    rerender(<PubFilters {...props} locating={true} />);
    expect(screen.getByRole('button', { name: 'Finding you…' })).toBeDisabled();
  });

  it('shows a location error', () => {
    render(<PubFilters {...filterProps()} locationError="Location access is blocked." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Location access is blocked.');
  });
});

describe('Visits', () => {
  let restore: () => void;
  beforeEach(() => {
    // Wide enough for every card to be drawn
    restore = stubLayout({ width: 1000, height: 2000, rowHeight: 300 });
    setMediaQueryMatches(() => false);
  });
  afterEach(() => restore());

  const renderVisits = (overrides: Partial<React.ComponentProps<typeof Visits>> = {}) => {
    const props = {
      locations: samplePubs,
      indexedVisits: {},
      onOpenCard: vi.fn(),
      selectedLocationId: 1,
      sortBy: 'name-asc',
      onSortChange: vi.fn(),
      filterKey: '',
      userPosition: null as { lat: number; lon: number } | null,
      ...overrides,
    };
    render(<Visits {...props} />);
    return props;
  };
  const cardNames = () =>
    screen.getAllByRole('button', { name: /, / }).map((card) => card.getAttribute('aria-label'));

  it('lists the pubs, sorted', () => {
    renderVisits();
    expect(screen.getByRole('heading', { name: 'Cards' })).toBeInTheDocument();
    expect(cardNames()).toEqual([
      'The Counting House, Glasgow',
      'The Cuthbert Brodrick, Leeds',
      'The Hedley Verity, Leeds',
      'The Punch Bowl, York',
    ]);
  });

  it('changes the sort order', async () => {
    const props = renderVisits();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'rarity-desc');
    expect(props.onSortChange).toHaveBeenCalledWith('rarity-desc');
  });

  it('only offers sorting by distance once the user has been found', () => {
    renderVisits();
    expect(screen.queryByRole('option', { name: 'Distance (nearest first)' })).not.toBeInTheDocument();
  });

  it('sorts as asked', () => {
    renderVisits({ sortBy: 'rarity-desc' });
    expect(cardNames()[0]).toBe('The Counting House, Glasgow');
    expect(cardNames()[3]).toBe('The Cuthbert Brodrick, Leeds');
  });

  it('sorts by distance from the user once found, and shows it', () => {
    // In York
    renderVisits({ sortBy: 'distance', userPosition: { lat: 53.96, lon: -1.08 } });
    expect(cardNames()[0]).toBe('The Punch Bowl, York');
    expect(cardNames()[3]).toBe('The Counting House, Glasgow');
    expect(screen.getByRole('button', { name: 'The Punch Bowl, York' })).toHaveTextContent('Distance');
  });

  it('opens a card when clicked', async () => {
    const props = renderVisits();
    await userEvent.click(screen.getByRole('button', { name: 'The Punch Bowl, York' }));
    expect(props.onOpenCard).toHaveBeenCalledWith(3);
  });

});
