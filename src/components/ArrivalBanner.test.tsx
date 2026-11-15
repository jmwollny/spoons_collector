import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArrivalBanner } from './ArrivalBanner';
import { leeds2 } from '../test/fixtures';

describe('ArrivalBanner', () => {
  it("says which pub the user is at", () => {
    render(<ArrivalBanner pub={leeds2} onShow={vi.fn()} onCheckIn={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent("You're atThe Hedley Verity");
  });

  it('names the stop when on a crawl', () => {
    render(
      <ArrivalBanner
        pub={leeds2}
        crawlStop={{ number: 2, of: 4 }}
        onShow={vi.fn()}
        onCheckIn={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent("You've reached stop 2 of 4The Hedley Verity");
  });

  it('shows the pub, checks in, or goes away', async () => {
    const handlers = { onShow: vi.fn(), onCheckIn: vi.fn(), onDismiss: vi.fn() };
    render(<ArrivalBanner pub={leeds2} {...handlers} />);
    await userEvent.click(screen.getByText('The Hedley Verity'));
    await userEvent.click(screen.getByRole('button', { name: 'Check in' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(handlers.onShow).toHaveBeenCalledOnce();
    expect(handlers.onCheckIn).toHaveBeenCalledOnce();
    expect(handlers.onDismiss).toHaveBeenCalledOnce();
  });
});
