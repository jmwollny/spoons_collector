import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrailNav } from './TrailNav';
import { leeds1, leeds2, makeTrail, trailStep } from '../test/fixtures';

describe('TrailNav', () => {
  it('steps to the next and previous pubs, naming them', async () => {
    const trail = makeTrail({ previous: trailStep(leeds1, 0.1) });
    render(<TrailNav trail={trail} variant="map" />);
    const next = screen.getByRole('button', { name: /^Next: The Hedley Verity/ });
    expect(next).toHaveAccessibleName('Next: The Hedley Verity, Leeds, 0.1 mi away');
    expect(next).toHaveAttribute('title', 'Next: The Hedley Verity · 0.1 mi (→)');
    await userEvent.click(next);
    await userEvent.click(screen.getByRole('button', { name: 'Back to The Cuthbert Brodrick' }));
    expect(trail.goNext).toHaveBeenCalledOnce();
    expect(trail.goPrevious).toHaveBeenCalledOnce();
    expect(screen.getByRole('navigation', { name: 'Nearby pubs' })).toHaveClass('trail-nav--map');
  });

  it('disables a direction with nowhere to go', () => {
    render(<TrailNav trail={makeTrail({ next: null })} variant="viewer" />);
    expect(screen.getByRole('button', { name: 'No previous pub' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'No more pubs nearby' })).toBeDisabled();
  });

  it('on a crawl, numbers the stops', () => {
    const trail = makeTrail({
      mode: 'crawl',
      previous: trailStep(leeds1, 0.1, 1),
      next: trailStep(leeds2, 0.1, 3),
    });
    render(<TrailNav trail={trail} variant="map" />);
    expect(screen.getByRole('navigation', { name: 'Crawl stops' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Next: Stop 3: The Hedley Verity/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Stop 1: The Cuthbert Brodrick' })).toBeInTheDocument();
  });

  it('at the last stop, says so', () => {
    render(<TrailNav trail={makeTrail({ mode: 'crawl', next: null })} variant="map" />);
    expect(screen.getByRole('button', { name: 'Last stop on the crawl' })).toBeDisabled();
  });
});
