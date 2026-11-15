import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVisitEditor } from './useVisitEditor';
import type { VisitsApi } from './useVisits';
import { makeVisit } from '../test/fixtures';

const visitsApi = () => ({ addVisit: vi.fn(), updateVisit: vi.fn() }) as unknown as VisitsApi;
const submitEvent = () => ({ preventDefault: vi.fn() }) as unknown as React.SubmitEvent<HTMLFormElement>;

describe('useVisitEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 15, 12));
  });
  afterEach(() => vi.useRealTimers());

  it('opens a blank form for today', () => {
    const { result } = renderHook(() => useVisitEditor(1, visitsApi()));
    expect(result.current.isOpen).toBe(false);
    act(() => result.current.openAdd());
    expect(result.current.isOpen).toBe(true);
    expect(result.current.isEditing).toBe(false);
    expect(result.current.form).toEqual({ date: '2026-11-15', rating: -1 });
  });

  it('adds a visit to the selected pub', () => {
    const api = visitsApi();
    const { result } = renderHook(() => useVisitEditor(3, api));
    act(() => result.current.openAdd());
    act(() => result.current.setRating(2));
    const event = submitEvent();
    act(() => result.current.submit(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(api.addVisit).toHaveBeenCalledWith(3, '2026-11-15', 2);
    expect(result.current.isOpen).toBe(false);
  });

  it('edits a visit, filling the form from it', () => {
    const api = visitsApi();
    const { result } = renderHook(() => useVisitEditor(1, api));
    act(() => result.current.openEdit(makeVisit(1, '2026-10-01', { id: 'v1', rating: 0 })));
    expect(result.current.isEditing).toBe(true);
    expect(result.current.form).toEqual({ date: '2026-10-01', rating: 0 });
    act(() => result.current.setForm({ date: '2026-10-02', rating: 1 }));
    act(() => result.current.submit(submitEvent()));
    expect(api.updateVisit).toHaveBeenCalledWith('v1', '2026-10-02', 1);
    expect(api.addVisit).not.toHaveBeenCalled();
  });

  it("doesn't save without a date or a pub", () => {
    const api = visitsApi();
    const { result, rerender } = renderHook(({ id }) => useVisitEditor(id, api), { initialProps: { id: 1 } });
    act(() => result.current.openAdd());
    act(() => result.current.setForm({ date: '', rating: 1 }));
    act(() => result.current.submit(submitEvent()));
    rerender({ id: 0 });
    act(() => result.current.setForm({ date: '2026-11-15', rating: 1 }));
    act(() => result.current.submit(submitEvent()));
    expect(api.addVisit).not.toHaveBeenCalled();
    expect(result.current.isOpen).toBe(true);
  });

  it('closes, forgetting the edit', () => {
    const { result } = renderHook(() => useVisitEditor(1, visitsApi()));
    act(() => result.current.openEdit(makeVisit(1, '2026-10-01')));
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.isEditing).toBe(false);
    expect(result.current.form.date).toBe('2026-11-15');
  });
});
