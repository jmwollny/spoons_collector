import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVisitEditor } from './useVisitEditor';
import type { VisitsApi } from './useVisits';
import { makeVisit } from '../test/fixtures';
import { deletePhoto, savePhoto } from '../photos';

vi.mock('../photos', () => ({ savePhoto: vi.fn(), deletePhoto: vi.fn() }));

const visitsApi = () => ({ addVisit: vi.fn(), updateVisit: vi.fn() }) as unknown as VisitsApi;
const submitEvent = () => ({ preventDefault: vi.fn() }) as unknown as React.SubmitEvent<HTMLFormElement>;
const photo = new Blob(['jpeg'], { type: 'image/jpeg' });

describe('useVisitEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 15, 12));
    vi.mocked(savePhoto).mockReset().mockResolvedValue();
    vi.mocked(deletePhoto).mockReset().mockResolvedValue();
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.useRealTimers());

  it('opens a blank form for today', () => {
    const { result } = renderHook(() => useVisitEditor(1, visitsApi()));
    expect(result.current.isOpen).toBe(false);
    act(() => result.current.openAdd());
    expect(result.current.isOpen).toBe(true);
    expect(result.current.isEditing).toBe(false);
    expect(result.current.form).toEqual({
      date: '2026-11-15',
      rating: -1,
      drink: '',
      company: '',
      notes: '',
      photo: { kind: 'none' },
    });
  });

  it('adds a visit to the selected pub, with its details', async () => {
    const api = visitsApi();
    const { result } = renderHook(() => useVisitEditor(3, api));
    act(() => result.current.openAdd());
    act(() => {
      result.current.setRating(2);
      result.current.setForm((current) => ({ ...current, drink: ' Abbot Ale ', company: 'Sam', notes: '' }));
    });
    const event = submitEvent();
    await act(() => result.current.submit(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(api.addVisit).toHaveBeenCalledWith({
      id: `3-${new Date(2026, 10, 15, 12).getTime()}`,
      locationId: 3,
      date: '2026-11-15',
      rating: 2,
      // Trimmed, and empty text left out
      drink: 'Abbot Ale',
      company: 'Sam',
      notes: undefined,
      hasPhoto: undefined,
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('saves a new photo under the visit, marking it', async () => {
    const api = visitsApi();
    const { result } = renderHook(() => useVisitEditor(3, api));
    act(() => result.current.openAdd());
    act(() => result.current.choosePhoto(photo));
    expect(result.current.form.photo).toEqual({ kind: 'new', blob: photo, previewUrl: 'blob:preview' });
    await act(() => result.current.submit(submitEvent()));
    const visitId = vi.mocked(api.addVisit).mock.calls[0][0].id;
    expect(savePhoto).toHaveBeenCalledWith(visitId, photo);
    expect(vi.mocked(api.addVisit).mock.calls[0][0].hasPhoto).toBe(true);
    // The preview's URL is released
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('edits a visit, filling the form from it and keeping its photo', async () => {
    const api = visitsApi();
    const { result } = renderHook(() => useVisitEditor(1, api));
    const visit = makeVisit(1, '2026-10-01', { id: 'v1', rating: 0, drink: 'Ruddles', hasPhoto: true });
    act(() => result.current.openEdit(visit));
    expect(result.current.isEditing).toBe(true);
    expect(result.current.editingVisit).toBe(visit);
    expect(result.current.form).toMatchObject({ date: '2026-10-01', rating: 0, drink: 'Ruddles', photo: { kind: 'kept' } });
    act(() => result.current.setRating(1));
    await act(() => result.current.submit(submitEvent()));
    expect(api.updateVisit).toHaveBeenCalledWith('v1', expect.objectContaining({ rating: 1, hasPhoto: true }));
    expect(savePhoto).not.toHaveBeenCalled();
    expect(api.addVisit).not.toHaveBeenCalled();
  });

  it("removes a visit's photo only when saved", async () => {
    const api = visitsApi();
    const { result } = renderHook(() => useVisitEditor(1, api));
    act(() => result.current.openEdit(makeVisit(1, '2026-10-01', { id: 'v1', hasPhoto: true })));
    act(() => result.current.removePhoto());
    expect(result.current.form.photo).toEqual({ kind: 'removed' });
    expect(deletePhoto).not.toHaveBeenCalled();
    await act(() => result.current.submit(submitEvent()));
    expect(deletePhoto).toHaveBeenCalledWith('v1');
    expect(api.updateVisit).toHaveBeenCalledWith('v1', expect.objectContaining({ hasPhoto: undefined }));
  });

  it('removing a photo not yet saved just drops it', () => {
    const { result } = renderHook(() => useVisitEditor(1, visitsApi()));
    act(() => result.current.openAdd());
    act(() => result.current.choosePhoto(photo));
    act(() => result.current.removePhoto());
    expect(result.current.form.photo).toEqual({ kind: 'none' });
  });

  it("closing the form changes nothing", () => {
    const api = visitsApi();
    const { result } = renderHook(() => useVisitEditor(1, api));
    act(() => result.current.openEdit(makeVisit(1, '2026-10-01', { hasPhoto: true })));
    act(() => result.current.removePhoto());
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.isEditing).toBe(false);
    expect(deletePhoto).not.toHaveBeenCalled();
    expect(api.updateVisit).not.toHaveBeenCalled();
  });

  it("doesn't save without a date or a pub", async () => {
    const api = visitsApi();
    const { result, rerender } = renderHook(({ id }) => useVisitEditor(id, api), { initialProps: { id: 1 } });
    act(() => result.current.openAdd());
    act(() => result.current.setForm((current) => ({ ...current, date: '' })));
    await act(() => result.current.submit(submitEvent()));
    rerender({ id: 0 });
    act(() => result.current.setForm((current) => ({ ...current, date: '2026-11-15' })));
    await act(() => result.current.submit(submitEvent()));
    expect(api.addVisit).not.toHaveBeenCalled();
    expect(result.current.isOpen).toBe(true);
  });

  it('says when the photo cannot be saved, keeping the form open', async () => {
    vi.mocked(savePhoto).mockRejectedValue(new Error('Storage full'));
    const api = visitsApi();
    const { result } = renderHook(() => useVisitEditor(1, api));
    act(() => result.current.openAdd());
    act(() => result.current.choosePhoto(photo));
    await act(() => result.current.submit(submitEvent()));
    expect(result.current.saveError).toBe("Couldn't save the photo: Storage full");
    expect(result.current.isOpen).toBe(true);
    expect(result.current.isSaving).toBe(false);
    expect(api.addVisit).not.toHaveBeenCalled();
  });
});
