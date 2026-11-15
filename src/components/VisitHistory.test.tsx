import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisitHistory } from './VisitHistory';
import { makeVisit } from '../test/fixtures';

const visits = [makeVisit(1, '2026-11-14', { rating: 2 }), makeVisit(1, '2026-10-01', { rating: 0 })];

const renderHistory = () => {
  const handlers = { onAdd: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onClose: vi.fn() };
  render(<VisitHistory pubName="The Cuthbert Brodrick" visits={visits} {...handlers} />);
  return handlers;
};

describe('VisitHistory', () => {
  it('lists each visit with its date and rating', () => {
    renderHistory();
    expect(screen.getByRole('dialog', { name: 'Visits to The Cuthbert Brodrick' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('14 Nov 2026')).toBeInTheDocument();
    expect(within(items[0]).getByRole('img', { name: 'Rated 3 out of 3' })).toBeInTheDocument();
    expect(within(items[1]).getByRole('img', { name: 'Rated 1 out of 3' })).toBeInTheDocument();
  });

  it('edits or deletes the visit chosen', async () => {
    const { onEdit, onDelete } = renderHistory();
    const second = screen.getAllByRole('listitem')[1];
    await userEvent.click(within(second).getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith(visits[1]);
    await userEvent.click(within(second).getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(visits[1]);
  });

  it('adds another visit, or closes', async () => {
    const { onAdd, onClose } = renderHistory();
    await userEvent.click(screen.getByRole('button', { name: 'Add another visit' }));
    expect(onAdd).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
