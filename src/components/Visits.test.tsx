import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Visits } from './Visits';
import { CollectionToolbar } from './CollectionToolbar';
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

const toolbarProps = () => ({
  searchTerm: '',
  onSearchChange: vi.fn(),
  regions: ['Scotland', 'Wales'],
  selectedRegion: 'all',
  onRegionChange: vi.fn(),
  visitFilter: 'all' as const,
  onVisitFilterChange: vi.fn(),
  sortBy: 'name-asc',
  onSortChange: vi.fn(),
  canSortByDistance: false,
  onNearMe: vi.fn(),
  locating: false,
});

describe('CollectionToolbar', () => {
  it('searches, filters and sorts', async () => {
    const props = toolbarProps();
    render(<CollectionToolbar {...props} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search pub or city' }), 'L');
    expect(props.onSearchChange).toHaveBeenCalledWith('L');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Region' }), 'Wales');
    expect(props.onRegionChange).toHaveBeenCalledWith('Wales');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Visited or not' }), 'unvisited');
    expect(props.onVisitFilterChange).toHaveBeenCalledWith('unvisited');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'rarity-desc');
    expect(props.onSortChange).toHaveBeenCalledWith('rarity-desc');
  });

  it('offers every region, and all of them', () => {
    render(<CollectionToolbar {...toolbarProps()} />);
    const regions = screen.getByRole('combobox', { name: 'Region' });
    expect([...regions.querySelectorAll('option')].map((option) => option.textContent)).toEqual([
      'All regions',
      'Scotland',
      'Wales',
    ]);
  });

  it('only offers sorting by distance once the user has been found', () => {
    const { rerender } = render(<CollectionToolbar {...toolbarProps()} />);
    expect(screen.queryByRole('option', { name: 'Distance (nearest first)' })).not.toBeInTheDocument();
    rerender(<CollectionToolbar {...toolbarProps()} canSortByDistance={true} />);
    expect(screen.getByRole('option', { name: 'Distance (nearest first)' })).toBeInTheDocument();
  });

  it('finds the user, and shows when it is', async () => {
    const props = toolbarProps();
    const { rerender } = render(<CollectionToolbar {...props} />);
    await userEvent.click(screen.getByRole('button', { name: '📍 Near me' }));
    expect(props.onNearMe).toHaveBeenCalledOnce();
    rerender(<CollectionToolbar {...props} locating={true} />);
    expect(screen.getByRole('button', { name: 'Finding you…' })).toBeDisabled();
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
      regions: ['Scotland', 'Yorkshire and The Humber'],
      indexedVisits: {},
      onOpenCard: vi.fn(),
      selectedLocationId: 1,
      searchTerm: '',
      selectedRegion: 'all',
      visitFilter: 'all' as const,
      onSearchChange: vi.fn(),
      onRegionChange: vi.fn(),
      onVisitFilterChange: vi.fn(),
      sortBy: 'name-asc',
      onSortChange: vi.fn(),
      userPosition: null,
      onNearMe: vi.fn(),
      locating: false,
      locationError: null,
      ...overrides,
    };
    render(<Visits {...props} />);
    return props;
  };
  const cardNames = () =>
    screen.getAllByRole('button', { name: /, / }).map((card) => card.getAttribute('aria-label'));

  it('counts and lists the pubs, sorted', () => {
    renderVisits();
    expect(screen.getByRole('heading', { name: 'Showing 4 Wetherspoon pubs' })).toBeInTheDocument();
    expect(cardNames()).toEqual([
      'The Counting House, Glasgow',
      'The Cuthbert Brodrick, Leeds',
      'The Hedley Verity, Leeds',
      'The Punch Bowl, York',
    ]);
  });

  it('says "pub" for one', () => {
    renderVisits({ locations: [leeds1] });
    expect(screen.getByRole('heading', { name: 'Showing 1 Wetherspoon pub' })).toBeInTheDocument();
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

  it('shows a location error', () => {
    renderVisits({ locationError: 'Location access is blocked.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Location access is blocked.');
  });
});
