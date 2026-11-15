import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderHook } from '@testing-library/react';
import { useBodyScrollLock } from './useBodyScrollLock';
import { useMapExpanded } from './useMapExpanded';
import { useMediaQuery } from './useMediaQuery';
import { useDismiss } from './useDismiss';
import { useContentWidth, usePageOffset } from './useElementMeasurements';

describe('useBodyScrollLock', () => {
  it('stops the page scrolling until the last overlay closes', () => {
    const first = renderHook(() => useBodyScrollLock());
    const second = renderHook(() => useBodyScrollLock());
    expect(document.body.style.overflow).toBe('hidden');
    first.unmount();
    expect(document.body.style.overflow).toBe('hidden');
    second.unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('does nothing while inactive', () => {
    renderHook(() => useBodyScrollLock(false));
    expect(document.body.style.overflow).toBe('');
  });
});

describe('useMapExpanded', () => {
  it('expands and shrinks, locking the page meanwhile', () => {
    const { result } = renderHook(() => useMapExpanded());
    act(() => result.current.toggle());
    expect(result.current.isExpanded).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    act(() => result.current.toggle());
    expect(result.current.isExpanded).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('shrinks on Escape', () => {
    const { result } = renderHook(() => useMapExpanded());
    act(() => result.current.toggle());
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(result.current.isExpanded).toBe(false);
  });
});

describe('useMediaQuery', () => {
  it('follows the query as it changes', () => {
    let matches = false;
    let notify = () => {};
    window.matchMedia = vi.fn(() => ({
      get matches() {
        return matches;
      },
      addEventListener: (_: string, listener: () => void) => (notify = listener),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => useMediaQuery('(max-width: 600px)'));
    expect(result.current).toBe(false);
    matches = true;
    act(() => notify());
    expect(result.current).toBe(true);
  });
});

describe('useDismiss', () => {
  it('ignores other keys, and Escape when nothing is open', () => {
    const onDismiss = vi.fn();
    const { rerender } = renderHook(({ active }) => useDismiss(onDismiss, active), {
      initialProps: { active: false },
    });
    fireEvent.keyDown(window, { key: 'Escape' });
    rerender({ active: true });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('calls the latest handler', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ handler }) => useDismiss(handler), { initialProps: { handler: first } });
    rerender({ handler: second });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });
});

describe('element measurements', () => {
  it('reads an element’s width and how far down the page it starts', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'clientWidth', { value: 480 });
    element.getBoundingClientRect = () => ({ top: 120 }) as DOMRect;
    Object.defineProperty(window, 'scrollY', { value: 30, configurable: true });
    const ref = { current: element };
    expect(renderHook(() => useContentWidth(ref)).result.current).toBe(480);
    expect(renderHook(() => usePageOffset(ref)).result.current).toBe(150);
  });

  it('copes with no element', () => {
    const ref = { current: null };
    expect(renderHook(() => useContentWidth(ref)).result.current).toBe(0);
    expect(renderHook(() => usePageOffset(ref)).result.current).toBe(0);
  });
});
