import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroHeader } from './HeroHeader';
import { makeVisit, samplePubs, samplePubsById } from '../test/fixtures';

describe('HeroHeader', () => {
  it('shows the title, how many pubs are collected, the menu, and a mosaic of photos', () => {
    const { container } = render(
      <HeroHeader
        visits={[makeVisit(1, '2026-11-01')]}
        locations={samplePubs}
        pubsById={samplePubsById}
        visitedCount={1}
      >
        <button type="button">Menu</button>
      </HeroHeader>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Spoons Collector' })).toBeInTheDocument();
    expect(screen.getByText(/of 4 pubs collected/)).toHaveTextContent('1 of 4 pubs collected');
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
    expect(container.querySelector('.hero-backdrop')).toHaveAttribute('aria-hidden', 'true');
    const mosaic = container.querySelector('.hero-mosaic')!;
    expect(mosaic.querySelectorAll('.hero-tile').length).toBeGreaterThan(0);
  });
});
