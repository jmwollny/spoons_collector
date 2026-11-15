import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardViewer } from './CardViewer';
import { leeds1, makeTrail } from '../test/fixtures';
import { touch } from '../test/browser';

const renderViewer = (overrides: Partial<React.ComponentProps<typeof CardViewer>> = {}) => {
  const props = {
    pub: leeds1,
    rating: 1,
    visitCount: 2,
    date: '14 Nov 2026',
    onAddVisit: vi.fn(),
    onShowVisits: vi.fn(),
    onShowOnMap: vi.fn(),
    onClose: vi.fn(),
    trail: makeTrail(),
    ...overrides,
  };
  const view = render(<CardViewer {...props} />);
  return { ...props, ...view };
};

const card = (container: HTMLElement) => container.querySelector('.spoon-card')!;

describe('CardViewer', () => {
  it('shows the pub full size in a dialog', () => {
    const { container } = renderViewer({ distanceMiles: 3.21 });
    expect(screen.getByRole('dialog', { name: 'The Cuthbert Brodrick' })).toBeInTheDocument();
    expect(card(container)).toHaveClass('full');
    expect(card(container)).toHaveTextContent('3.2 mi');
  });

  it('flips to the history and back, from the card or the button', async () => {
    const { container } = renderViewer();
    await userEvent.click(screen.getByRole('button', { name: '↻ History' }));
    expect(card(container)).toHaveClass('is-flipped');
    await userEvent.click(screen.getByRole('button', { name: '↺ Front' }));
    expect(card(container)).not.toHaveClass('is-flipped');
    await userEvent.click(card(container));
    expect(card(container)).toHaveClass('is-flipped');
  });

  it('offers visits, the map and adding a visit', async () => {
    const props = renderViewer();
    await userEvent.click(screen.getByRole('button', { name: '2 visits' }));
    await userEvent.click(screen.getByRole('button', { name: '🗺 Map' }));
    await userEvent.click(screen.getByRole('button', { name: '+ Add visit' }));
    expect(props.onShowVisits).toHaveBeenCalledOnce();
    expect(props.onShowOnMap).toHaveBeenCalledOnce();
    expect(props.onAddVisit).toHaveBeenCalledOnce();
  });

  it('says "1 visit", and leaves it out with none', () => {
    const { rerender } = renderViewer({ visitCount: 1 });
    expect(screen.getByRole('button', { name: '1 visit' })).toBeInTheDocument();
    rerender(
      <CardViewer
        pub={leeds1}
        rating={-1}
        visitCount={0}
        date={null}
        onAddVisit={vi.fn()}
        onShowVisits={vi.fn()}
        onShowOnMap={vi.fn()}
        onClose={vi.fn()}
        trail={makeTrail()}
      />,
    );
    expect(screen.queryByRole('button', { name: /^\d+ visits?$/ })).not.toBeInTheDocument();
  });

  it('closes from ✕, Escape or a tap outside, and locks the page meanwhile', async () => {
    const props = renderViewer();
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('dialog').parentElement!);
    expect(props.onClose).toHaveBeenCalledTimes(3);
    props.unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('swipes sideways to step to other pubs, without flipping', () => {
    const props = renderViewer();
    const backdrop = screen.getByRole('dialog').parentElement!;
    fireEvent.touchStart(backdrop, touch(300, 400));
    fireEvent.touchEnd(backdrop, touch(100, 410));
    expect(props.trail.goNext).toHaveBeenCalledOnce();
    // The tap that ends a swipe doesn't flip the card
    fireEvent.click(card(props.container));
    expect(card(props.container)).not.toHaveClass('is-flipped');

    fireEvent.touchStart(backdrop, touch(100, 400));
    fireEvent.touchEnd(backdrop, touch(300, 400));
    expect(props.trail.goPrevious).toHaveBeenCalledOnce();
  });

  it('swipes down to close, but not while scrolling the history', () => {
    const props = renderViewer();
    const backdrop = screen.getByRole('dialog').parentElement!;
    const history = props.container.querySelector('.card-back-text')!;
    fireEvent.touchStart(history, touch(200, 100));
    fireEvent.touchEnd(history, touch(200, 300));
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.touchStart(backdrop, touch(200, 100));
    fireEvent.touchEnd(backdrop, touch(200, 300));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('has Previous and Next under the card', async () => {
    const props = renderViewer();
    await userEvent.click(screen.getByRole('button', { name: /^Next: The Hedley Verity/ }));
    expect(props.trail.goNext).toHaveBeenCalledOnce();
  });
});
