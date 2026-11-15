import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisitHistory } from './VisitHistory';
import { makeVisit } from '../test/fixtures';
import { loadPhotoUrl } from '../photos';

vi.mock('../photos', () => ({ loadPhotoUrl: vi.fn(async (id: string) => (id === 'with-photo' ? 'blob:photo' : null)) }));

const visits = [
  makeVisit(1, '2026-11-14', {
    id: 'with-photo',
    rating: 2,
    drink: 'Abbot Ale',
    company: 'Sam and Alex',
    notes: 'Quiz night',
    hasPhoto: true,
  }),
  makeVisit(1, '2026-10-01', { rating: 0 }),
];

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

  it('shows what was drunk, who with and any notes', () => {
    renderHistory();
    const [first, second] = screen.getAllByRole('listitem');
    expect(within(first).getByText('🍺 Abbot Ale · 👥 Sam and Alex')).toBeInTheDocument();
    expect(within(first).getByText('Quiz night')).toBeInTheDocument();
    expect(second).not.toHaveTextContent('🍺');
  });

  it("shows a visit's photo, full size when tapped", async () => {
    renderHistory();
    const thumbnail = await screen.findByRole('button', { name: 'Photo from 14 Nov 2026' });
    expect(thumbnail.querySelector('img')).toHaveAttribute('src', 'blob:photo');
    await userEvent.click(thumbnail);
    const photo = screen.getByRole('dialog', { name: 'The Cuthbert Brodrick, 14 Nov 2026' });
    expect(within(photo).getByRole('img', { name: 'At The Cuthbert Brodrick on 14 Nov 2026' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    // Escape closes the photo, not the visit list behind it
    expect(screen.queryByRole('dialog', { name: /14 Nov 2026$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Visits to The Cuthbert Brodrick' })).toBeInTheDocument();
    // Only visits marked as having a photo look for one
    expect(loadPhotoUrl).toHaveBeenCalledWith('with-photo');
    expect(loadPhotoUrl).not.toHaveBeenCalledWith(visits[1].id);
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
    await userEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
