import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisitFormModal } from './VisitFormModal';
import type { VisitEditor } from '../hooks/useVisitEditor';
import { samplePubs } from '../test/fixtures';
import { loadPhotoUrl, shrinkPhoto } from '../photos';

const shrunk = new Blob(['small']);
vi.mock('../photos', () => ({
  shrinkPhoto: vi.fn(async () => shrunk),
  loadPhotoUrl: vi.fn(async () => null),
}));

const editor = (overrides: Partial<VisitEditor> = {}): VisitEditor => ({
  isOpen: true,
  isEditing: false,
  editingVisit: null,
  form: { date: '2026-11-15', rating: -1, drink: '', company: '', notes: '', photo: { kind: 'none' } },
  setForm: vi.fn(),
  setRating: vi.fn(),
  choosePhoto: vi.fn(),
  removePhoto: vi.fn(),
  isSaving: false,
  saveError: null,
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

  it('shrinks a chosen photo before keeping it, and removes photos', async () => {
    const formEditor = editor({ form: { ...editor().form, photo: { kind: 'new', blob: new Blob(), previewUrl: 'blob:x' } } });
    render(<VisitFormModal editor={formEditor} locations={samplePubs} selectedId={1} onSelectPub={vi.fn()} />);
    const file = new File(['jpeg'], 'pub.jpg', { type: 'image/jpeg' });
    await userEvent.upload(screen.getByLabelText(/Change photo/), file);
    expect(shrinkPhoto).toHaveBeenCalledWith(file);
    await vi.waitFor(() => expect(formEditor.choosePhoto).toHaveBeenCalledWith(shrunk));
    await userEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(formEditor.removePhoto).toHaveBeenCalledOnce();
  });

  it("loads the saved photo of the visit being edited", async () => {
    vi.mocked(loadPhotoUrl).mockResolvedValue('blob:saved');
    const formEditor = editor({
      isEditing: true,
      editingVisit: { id: 'v1', locationId: 1, date: '2026-11-01', rating: 1, hasPhoto: true },
      form: { ...editor().form, photo: { kind: 'kept' } },
    });
    render(<VisitFormModal editor={formEditor} locations={samplePubs} selectedId={1} onSelectPub={vi.fn()} />);
    expect(await screen.findByRole('img', { name: "This visit's photo" })).toHaveAttribute('src', 'blob:saved');
    expect(loadPhotoUrl).toHaveBeenCalledWith('v1');
  });
});
