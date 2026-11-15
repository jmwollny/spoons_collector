import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Achievements } from './Achievements';
import { makeVisit, samplePubs } from '../test/fixtures';

const row = (title: string) => screen.getByText(title).closest('li')!;

describe('Achievements', () => {
  it('shows progress towards each achievement', () => {
    render(<Achievements locations={samplePubs} visitedLocationIds={new Set()} indexedVisits={{}} />);
    expect(within(row('First Pint')).getByText('0/1')).toBeInTheDocument();
    expect(within(row('Spoons Master')).getByText('0/4')).toBeInTheDocument();
    expect(row('First Pint')).not.toHaveClass('unlocked');
  });

  it('marks achievements unlocked', () => {
    const visits = { 4: [makeVisit(4, '2026-11-01')] };
    render(
      <Achievements locations={samplePubs} visitedLocationIds={new Set([4])} indexedVisits={visits} />,
    );
    expect(row('First Pint')).toHaveClass('unlocked');
    expect(within(row('First Pint')).getByText('Unlocked')).toBeInTheDocument();
    // Glasgow's pub is Legendary
    expect(row('Off the Beaten Track')).toHaveClass('unlocked');
    expect(within(row('Grand Tour')).getByText('1/2')).toBeInTheDocument();
  });

  it('caps progress at the target', () => {
    const ids = new Set(samplePubs.map((pub) => pub.id));
    render(<Achievements locations={samplePubs} visitedLocationIds={ids} indexedVisits={{}} />);
    expect(within(row('Bronze Pint')).getByText('4/10')).toBeInTheDocument();
    expect(row('Spoons Master')).toHaveClass('unlocked');
  });

  it('includes achievements for finished crawls', () => {
    const crawl = { id: 'c1', date: '2026-11-01', pubCount: 5, totalMiles: 2, mode: 'walk' as const, score: 220, meals: ['Breakfast' as const, 'Lunch' as const], treasureHunt: false, revealedCount: 0 };
    render(<Achievements locations={samplePubs} visitedLocationIds={new Set()} indexedVisits={{}} crawls={[crawl]} />);
    expect(row('Crawler')).toHaveClass('unlocked');
    expect(row('Marathon')).toHaveClass('unlocked');
    expect(within(row('Full English')).getByText('2/3')).toBeInTheDocument();
    expect(within(row('High Scorer')).getByText('220/500')).toBeInTheDocument();
  });
});
