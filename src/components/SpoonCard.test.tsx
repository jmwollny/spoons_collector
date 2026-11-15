import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SpoonCard, { type SpoonCardProps } from './SpoonCard';
import { spoonCardClassName } from './card/cardClassName';

const props = (overrides: Partial<SpoonCardProps> = {}): SpoonCardProps => ({
  id: 1783,
  name: 'The Cuthbert Brodrick',
  city: 'Leeds',
  region: 'Yorkshire and The Humber',
  rarity: 'Rare',
  history: 'Named after the architect of Leeds Town Hall.',
  rating: 1,
  visited: true,
  visitCount: 1,
  date: '14 Nov 2026',
  hasImage: true,
  nearestMiles: 0.12,
  secondMiles: 4.6,
  website: 'https://example.com/pub',
  menu: 'https://example.com/menu',
  ...overrides,
});

const front = (container: HTMLElement) => container.querySelector<HTMLElement>('.card-face-front')!;
const back = (container: HTMLElement) => container.querySelector<HTMLElement>('.card-face-back')!;
const stat = (container: HTMLElement, label: string) =>
  within(front(container)).getByText(label).closest('.stat-row')!;

describe('SpoonCard front', () => {
  it('shows the pub, its photo and its stats', () => {
    const { container } = render(<SpoonCard {...props()} />);
    const face = within(front(container));
    expect(face.getByRole('heading', { name: 'The Cuthbert Brodrick' })).toBeInTheDocument();
    expect(face.getByText('Visited')).toBeInTheDocument();
    expect(face.getByRole('img', { name: 'The Cuthbert Brodrick' })).toHaveAttribute(
      'src',
      '/images/1783.webp',
    );
    expect(face.getByText('Yorkshire and The Humber')).toBeInTheDocument();
    expect(stat(container, 'Rarity')).toHaveTextContent('Rare');
    expect(stat(container, 'Locality')).toHaveTextContent('Leeds');
    expect(stat(container, 'Visit date')).toHaveTextContent('14 Nov 2026');
    expect(face.getByRole('img', { name: 'Rated 2 out of 3' })).toBeInTheDocument();
  });

  it('without a photo, shows the placeholder only', () => {
    const { container } = render(<SpoonCard {...props({ hasImage: false })} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.card-map-fallback')).toBeInTheDocument();
  });

  it('hides a photo that fails to load', () => {
    const { container } = render(<SpoonCard {...props()} />);
    const photo = container.querySelector('img')!;
    fireEvent.error(photo);
    expect(photo).toHaveStyle({ display: 'none' });
  });

  it('for an unvisited pub, says so and has no badge', () => {
    const { container } = render(
      <SpoonCard {...props({ visited: false, visitCount: 0, date: null, rating: -1 })} />,
    );
    expect(within(front(container)).queryByText('Visited')).not.toBeInTheDocument();
    expect(stat(container, 'Visit date')).toHaveTextContent('Not visited');
  });

  it('with several visits, counts them and shows the last', () => {
    const { container } = render(<SpoonCard {...props({ visitCount: 3 })} />);
    expect(stat(container, 'Visits')).toHaveTextContent('3');
    expect(stat(container, 'Last visit')).toHaveTextContent('14 Nov 2026');
  });

  it('shows the distance from the user, once known', () => {
    const { container, rerender } = render(<SpoonCard {...props()} />);
    expect(within(front(container)).queryByText('Distance')).not.toBeInTheDocument();
    rerender(<SpoonCard {...props({ distanceMiles: 2.345 })} />);
    expect(stat(container, 'Distance')).toHaveTextContent('2.3 mi');
  });

  it('compact, leaves out visits, date and rating', () => {
    const { container } = render(<SpoonCard {...props({ compact: true, visitCount: 3 })} />);
    const face = within(front(container));
    expect(face.queryByText('Visits')).not.toBeInTheDocument();
    expect(face.queryByText('Last visit')).not.toBeInTheDocument();
    expect(face.queryByText('Rating')).not.toBeInTheDocument();
    expect(face.getByText('Rarity')).toBeInTheDocument();
  });
});

describe('SpoonCard back', () => {
  // The back is hidden from screen readers until the card is flipped
  it('shows the history, distances to other Spoons and links', () => {
    const { container } = render(<SpoonCard {...props({ flipped: true })} />);
    const face = within(back(container));
    expect(face.getByText('Named after the architect of Leeds Town Hall.')).toBeInTheDocument();
    expect(face.getByText('Nearest Spoons').nextElementSibling).toHaveTextContent('0.1 mi');
    expect(face.getByText('Next nearest').nextElementSibling).toHaveTextContent('4.6 mi');
    expect(face.getByRole('link', { name: 'Pub page ↗' })).toHaveAttribute('href', 'https://example.com/pub');
    expect(face.getByRole('link', { name: 'Menu ↗' })).toHaveAttribute('target', '_blank');
  });

  it('leaves out links it does not have', () => {
    const { container, rerender } = render(<SpoonCard {...props({ flipped: true, menu: 'NONE' })} />);
    expect(within(back(container)).queryByRole('link', { name: 'Menu ↗' })).not.toBeInTheDocument();
    expect(within(back(container)).getByRole('link', { name: 'Pub page ↗' })).toBeInTheDocument();
    rerender(<SpoonCard {...props({ flipped: true, menu: 'NONE', website: '' })} />);
    expect(within(back(container)).queryByRole('navigation')).not.toBeInTheDocument();
  });

  it("a link doesn't also flip the card", async () => {
    const onClick = vi.fn();
    const { container } = render(<SpoonCard {...props({ onClick, flipped: true })} />);
    await userEvent.click(within(back(container)).getByRole('link', { name: 'Menu ↗' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('only the face showing is visible to screen readers', () => {
    const { container, rerender } = render(<SpoonCard {...props()} />);
    expect(front(container)).toHaveAttribute('aria-hidden', 'false');
    expect(back(container)).toHaveAttribute('aria-hidden', 'true');
    rerender(<SpoonCard {...props({ flipped: true })} />);
    expect(front(container)).toHaveAttribute('aria-hidden', 'true');
    expect(back(container)).toHaveAttribute('aria-hidden', 'false');
  });
});

describe('SpoonCard', () => {
  it('reports clicks', async () => {
    const onClick = vi.fn();
    render(<SpoonCard {...props({ onClick })} />);
    await userEvent.click(screen.getAllByRole('heading')[0]);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is classed by rarity, size and state', () => {
    const { container } = render(<SpoonCard {...props({ small: true, selected: true, flipped: true })} />);
    expect(container.firstElementChild).toHaveClass('spoon-card', 'rarity-rare', 'small', 'selected', 'is-flipped');
    expect(container.firstElementChild).toHaveAttribute('data-region', 'yorkshire and the humber');
  });
});

describe('spoonCardClassName', () => {
  it('lists only the classes that apply', () => {
    expect(spoonCardClassName(props({ rarity: 'Legendary', visited: false }))).toBe(
      'spoon-card rarity-legendary unvisited',
    );
    expect(spoonCardClassName(props({ medium: true, full: true, compact: true }))).toBe(
      'spoon-card rarity-rare medium full compact',
    );
  });
});
