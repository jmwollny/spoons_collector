import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressRow } from './ProgressRow';
import { RarityProgress } from './RarityProgress';
import { RegionBreakdown } from './RegionBreakdown';
import { samplePubs } from '../test/fixtures';

const inList = (ui: React.ReactElement) => render(<ul>{ui}</ul>);

describe('ProgressRow', () => {
  it('shows visited out of total, with a matching progress bar', () => {
    inList(<ProgressRow label="Scotland" visited={1} total={4} />);
    expect(screen.getByText('1/4')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'Scotland' });
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(bar).toHaveAttribute('aria-valuemax', '4');
    expect(bar.firstElementChild).toHaveStyle({ width: '25%' });
  });

  it('copes with nothing to visit', () => {
    inList(<ProgressRow label="Empty" visited={0} total={0} />);
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '0%' });
  });

  it('takes a bar colour', () => {
    inList(<ProgressRow label="Epic" visited={1} total={1} color="rgb(139, 92, 246)" />);
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({
      background: 'rgb(139, 92, 246)',
    });
  });
});

describe('RarityProgress', () => {
  it('counts visited pubs in each rarity, rarest first', () => {
    render(<RarityProgress locations={samplePubs} visitedLocationIds={new Set([1, 4])} />);
    const bars = screen.getAllByRole('progressbar');
    expect(bars.map((bar) => bar.getAttribute('aria-label'))).toEqual([
      'Legendary',
      'Epic',
      'Rare',
      'Uncommon',
      'Common',
    ]);
    expect(screen.getByRole('progressbar', { name: 'Legendary' })).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('progressbar', { name: 'Epic' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByRole('progressbar', { name: 'Rare' })).toHaveAttribute('aria-valuemax', '0');
  });
});

describe('RegionBreakdown', () => {
  it('counts visited pubs in each region, A to Z', () => {
    render(<RegionBreakdown locations={samplePubs} visitedLocationIds={new Set([1, 2])} />);
    expect(screen.getAllByRole('progressbar').map((bar) => bar.getAttribute('aria-label'))).toEqual([
      'Scotland',
      'Yorkshire and The Humber',
    ]);
    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.getByText('0/1')).toBeInTheDocument();
  });
});
