import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapControls } from './MapControls';
import { MapLegend } from './MapLegend';
import { MapToast } from './MapToast';

describe('MapControls', () => {
  it('expands the map', async () => {
    const onToggleExpanded = vi.fn();
    render(<MapControls expanded={false} onToggleExpanded={onToggleExpanded} onNearMe={vi.fn()} locating={false} />);
    const expand = screen.getByRole('button', { name: 'Expand map to full screen' });
    expect(expand).toHaveAttribute('title', 'Full screen');
    await userEvent.click(expand);
    expect(onToggleExpanded).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /nearest pubs/ })).not.toBeInTheDocument();
  });

  it('when expanded, shrinks it and offers Near me', async () => {
    const onNearMe = vi.fn();
    render(<MapControls expanded={true} onToggleExpanded={vi.fn()} onNearMe={onNearMe} locating={false} />);
    expect(screen.getByRole('button', { name: 'Shrink map' })).toHaveTextContent('✕');
    await userEvent.click(screen.getByRole('button', { name: "Find the nearest pubs you haven't visited" }));
    expect(onNearMe).toHaveBeenCalledOnce();
  });

  it('shows Near me working', () => {
    render(<MapControls expanded={true} onToggleExpanded={vi.fn()} onNearMe={vi.fn()} locating={true} />);
    const nearMe = screen.getByRole('button', { name: "Find the nearest pubs you haven't visited" });
    expect(nearMe).toBeDisabled();
    expect(nearMe).toHaveTextContent('Finding you…');
  });
});

describe('MapLegend', () => {
  it('explains each marker', () => {
    render(<MapLegend />);
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Legendary',
      'Epic',
      'Rare',
      'Uncommon',
      'Common',
      'Visited',
    ]);
  });
});

describe('MapToast', () => {
  it('shows a message until dismissed', async () => {
    const { rerender } = render(<MapToast message="Location access is blocked." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Location access is blocked.');
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // The same message stays dismissed; a new one shows
    rerender(<MapToast message="Location access is blocked." />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    rerender(<MapToast message="Finding your location took too long." />);
    expect(screen.getByRole('alert')).toHaveTextContent('took too long');
  });

  it('shows nothing without a message', () => {
    render(<MapToast message={null} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
