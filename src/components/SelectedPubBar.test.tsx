import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectedPubBar } from './SelectedPubBar';
import { MapPubCard } from './MapPubCard';
import { leeds1, leeds2, makeTrail, trailStep } from '../test/fixtures';
import { touch } from '../test/browser';

const renderBar = (overrides: Partial<React.ComponentProps<typeof SelectedPubBar>> = {}) => {
  const props = {
    pub: leeds1,
    visitCount: 0,
    date: null,
    trail: makeTrail(),
    onOpen: vi.fn(),
    ...overrides,
  };
  const view = render(<SelectedPubBar {...props} />);
  return { ...props, ...view, sheet: view.container.firstElementChild as HTMLElement };
};

describe('SelectedPubBar', () => {
  it('shows the pub: photo, name, rarity, town and visits', () => {
    renderBar();
    const main = screen.getByRole('button', { name: 'Open the card for The Cuthbert Brodrick' });
    expect(main).toHaveTextContent('The Cuthbert BrodrickCommonLeedsNot visited');
    expect(main.querySelector('img')).toHaveAttribute('src', '/images/1.webp');
  });

  it('shows the latest visit, or how many', () => {
    const { rerender } = render(
      <SelectedPubBar pub={leeds2} visitCount={1} date="14 Nov 2026" trail={makeTrail()} onOpen={vi.fn()} />,
    );
    expect(screen.getByText('✓ 14 Nov 2026')).toBeInTheDocument();
    // No photo for this pub
    expect(screen.getByRole('button', { name: /Open the card/ }).querySelector('img')).toBeNull();
    rerender(
      <SelectedPubBar pub={leeds2} visitCount={3} date="14 Nov 2026" trail={makeTrail()} onOpen={vi.fn()} />,
    );
    expect(screen.getByText('✓ 3 visits')).toBeInTheDocument();
  });

  it('opens the full-size card when tapped', async () => {
    const props = renderBar();
    await userEvent.click(screen.getByRole('button', { name: /Open the card/ }));
    expect(props.onOpen).toHaveBeenCalledOnce();
  });

  it('steps with ‹ and ›', async () => {
    const props = renderBar({ trail: makeTrail({ previous: trailStep(leeds2) }) });
    await userEvent.click(screen.getByRole('button', { name: 'Next: The Hedley Verity, Leeds' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back to The Hedley Verity' }));
    expect(props.trail.goNext).toHaveBeenCalledOnce();
    expect(props.trail.goPrevious).toHaveBeenCalledOnce();
  });

  it('disables ‹ and › with nowhere to go', () => {
    renderBar({ trail: makeTrail({ next: null }) });
    expect(screen.getByRole('button', { name: 'No previous pub' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'No more pubs nearby' })).toBeDisabled();
  });

  it('on a crawl, says when it is the last stop', () => {
    renderBar({ trail: makeTrail({ mode: 'crawl', next: null }) });
    expect(screen.getByRole('button', { name: 'Last stop on the crawl' })).toBeDisabled();
  });

  it('pulls up the card from the handle, and puts it away', async () => {
    renderBar();
    const handle = screen.getByRole('button', { name: 'Show the card' });
    expect(handle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(handle);
    expect(screen.getByRole('button', { name: 'Hide the card' })).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('.spoon-card.compact')).toBeInTheDocument();
    expect(screen.getByText('Swipe sideways for nearby pubs')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hide the card' }));
    expect(document.querySelector('.spoon-card')).toBeNull();
  });

  it('opens the full-size card from the pulled-up card', async () => {
    const props = renderBar();
    await userEvent.click(screen.getByRole('button', { name: 'Show the card' }));
    await userEvent.click(document.querySelector('.spoon-card')!);
    expect(props.onOpen).toHaveBeenCalledOnce();
  });

  it('on a crawl, says swiping goes to the next stop', async () => {
    renderBar({ trail: makeTrail({ mode: 'crawl' }) });
    await userEvent.click(screen.getByRole('button', { name: 'Show the card' }));
    expect(screen.getByText('Swipe sideways for the next stop on your crawl')).toBeInTheDocument();
  });

  it('swipes up and down to show and hide the card', () => {
    const { sheet } = renderBar();
    fireEvent.touchStart(sheet, touch(200, 300));
    fireEvent.touchEnd(sheet, touch(200, 200));
    expect(sheet).toHaveClass('is-open');
    fireEvent.touchStart(sheet, touch(200, 200));
    fireEvent.touchEnd(sheet, touch(200, 300));
    expect(sheet).not.toHaveClass('is-open');
  });

  it("swipes sideways to step, and the swipe doesn't count as a tap", () => {
    const props = renderBar();
    fireEvent.touchStart(props.sheet, touch(300, 300));
    fireEvent.touchEnd(props.sheet, touch(200, 305));
    expect(props.trail.goNext).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /Open the card/ }));
    expect(props.onOpen).not.toHaveBeenCalled();
    // The next tap does open it
    fireEvent.click(screen.getByRole('button', { name: /Open the card/ }));
    expect(props.onOpen).toHaveBeenCalledOnce();

    fireEvent.touchStart(props.sheet, touch(200, 300));
    fireEvent.touchEnd(props.sheet, touch(300, 300));
    expect(props.trail.goPrevious).toHaveBeenCalledOnce();
  });

  it('ignores small movements', () => {
    const props = renderBar();
    fireEvent.touchStart(props.sheet, touch(200, 300));
    fireEvent.touchEnd(props.sheet, touch(220, 310));
    expect(props.trail.goNext).not.toHaveBeenCalled();
    expect(props.sheet).not.toHaveClass('is-open');
  });
});

describe('MapPubCard', () => {
  it('shows the compact card with Previous and Next, opening on click', async () => {
    const onOpen = vi.fn();
    const trail = makeTrail();
    render(
      <MapPubCard pub={leeds1} stats={{ count: 2, rating: 1, date: '14 Nov 2026' }} trail={trail} onOpen={onOpen} />,
    );
    const card = document.querySelector('.spoon-card')!;
    expect(card).toHaveClass('small', 'compact');
    expect(card).not.toHaveClass('unvisited');
    await userEvent.click(card);
    expect(onOpen).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: /^Next:/ }));
    expect(trail.goNext).toHaveBeenCalledOnce();
  });
});
