import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { App } from '@capacitor/app';
import { useDismiss } from './useDismiss';

// In the Android app: the Back button
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(), exitApp: vi.fn() } }));

const back = (canGoBack: boolean) => {
  const listener = vi.mocked(App.addListener).mock.calls[0][1] as (event: { canGoBack: boolean }) => void;
  listener({ canGoBack });
};

describe('useDismiss with the Android Back button', () => {
  it('closes what is open, then goes back, then leaves the app', () => {
    const onDismiss = vi.fn();
    const { unmount } = renderHook(() => useDismiss(onDismiss));
    expect(App.addListener).toHaveBeenCalledWith('backButton', expect.any(Function));

    back(true);
    expect(onDismiss).toHaveBeenCalledOnce();
    unmount();

    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    back(true);
    expect(historyBack).toHaveBeenCalledOnce();

    back(false);
    expect(App.exitApp).toHaveBeenCalledOnce();
  });
});
