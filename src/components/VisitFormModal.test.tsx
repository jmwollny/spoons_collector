import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisitFormModal } from './VisitFormModal';
import type { VisitEditor } from '../hooks/useVisitEditor';
import { samplePubs } from '../test/fixtures';

const editor = (overrides: Partial<VisitEditor> = {}): VisitEditor => ({
  isOpen: true,
  isEditing: false,
  form: { date: '2026-11-15', rating: -1 },
  setForm: vi.fn(),
  setRating: vi.fn(),
  openAdd: vi.fn(),
  openEdit: vi.fn(),
  close: vi.fn(),
  submit: vi.fn((event) => event.preventDefault()),
  ...overrides,
});

describe('VisitFormModal', () => {
  it('is titled Add visit, or Edit visit when editing', () => {
    const { rerender } = render(
      <VisitFormModal editor={editor()} locations={samplePubs} selectedId={1} onSelectPub={vi.fn()} />,
    );
    expect(screen.getByRole('dialog', { name: 'Add visit' })).toBeInTheDocument();
    rerender(
      <VisitFormModal
        editor={editor({ isEditing: true })}
        locations={samplePubs}
        selectedId={1}
        onSelectPub={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Edit visit' })).toBeInTheDocument();
  });

  it('submits through the editor and closes with it', async () => {
    const formEditor = editor();
    render(<VisitFormModal editor={formEditor} locations={samplePubs} selectedId={1} onSelectPub={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save visit' }));
    expect(formEditor.submit).toHaveBeenCalledOnce();
    await userEvent.keyboard('{Escape}');
    expect(formEditor.close).toHaveBeenCalledOnce();
  });

  it('rates through the editor and picks pubs through onSelectPub', async () => {
    const formEditor = editor();
    const onSelectPub = vi.fn();
    render(
      <VisitFormModal editor={formEditor} locations={samplePubs} selectedId={1} onSelectPub={onSelectPub} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Rate 3 out of 3' }));
    expect(formEditor.setRating).toHaveBeenCalledWith(2);
    await userEvent.selectOptions(screen.getByRole('combobox'), '3');
    expect(onSelectPub).toHaveBeenCalledWith(3);
  });
});
