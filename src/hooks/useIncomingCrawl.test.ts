import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { useIncomingCrawl } from './useIncomingCrawl';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn(() => false) } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn() } }));

describe('useIncomingCrawl', () => {
  beforeEach(() => vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false));
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('picks up ?crawl= on the web page, and forgets it once dealt with', () => {
    window.history.replaceState(null, '', '/?crawl=SC1.abc123&other=1');
    const { result } = renderHook(() => useIncomingCrawl());
    expect(result.current.code).toBe('SC1.abc123');
    act(() => result.current.clear());
    expect(result.current.code).toBeNull();
    expect(window.location.search).toBe('?other=1');
  });

  it('has nothing without one', () => {
    const { result } = renderHook(() => useIncomingCrawl());
    expect(result.current.code).toBeNull();
    act(() => result.current.clear());
    expect(window.location.search).toBe('');
  });

  it('in the Android app, takes codes from links that open it', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const remove = vi.fn();
    let open: (event: { url: string }) => void = () => {};
    vi.mocked(App.addListener).mockImplementation(((_: string, listener: typeof open) => {
      open = listener;
      return Promise.resolve({ remove });
    }) as unknown as typeof App.addListener);
    const { result, unmount } = renderHook(() => useIncomingCrawl());
    act(() => open({ url: 'spoonscollector://crawl/SC1.xyz' }));
    expect(result.current.code).toBe('SC1.xyz');
    act(() => open({ url: 'spoonscollector://somewhere-else' }));
    expect(result.current.code).toBe('SC1.xyz');
    unmount();
  });
});
