import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Geolocation } from '@capacitor/geolocation';
import { useLiveLocation } from './liveLocation';

vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  },
}));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn() } }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn(() => false) } }));

type WatchCallback = Parameters<typeof Geolocation.watchPosition>[1];
let report: WatchCallback = () => {};

const reading = (lat: number, lon: number, accuracy = 10) =>
  ({ coords: { latitude: lat, longitude: lon, accuracy } }) as Parameters<WatchCallback>[0];

beforeEach(() => {
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  vi.mocked(Geolocation.watchPosition).mockReset().mockImplementation(async (_options, callback) => {
    report = callback;
    return 'watch-1';
  });
  vi.mocked(Geolocation.clearWatch).mockReset().mockResolvedValue();
  vi.mocked(Geolocation.checkPermissions).mockReset();
  vi.mocked(Geolocation.requestPermissions).mockReset();
});

describe('useLiveLocation', () => {
  it("doesn't watch while off", () => {
    const { result } = renderHook(() => useLiveLocation(false));
    expect(Geolocation.watchPosition).not.toHaveBeenCalled();
    expect(result.current).toEqual({ position: null, error: null });
  });

  it('follows the position while on, then stops', async () => {
    const { result, rerender } = renderHook(({ on }) => useLiveLocation(on), { initialProps: { on: true } });
    await waitFor(() => expect(Geolocation.watchPosition).toHaveBeenCalled());
    expect(vi.mocked(Geolocation.watchPosition).mock.calls[0][0]).toMatchObject({ enableHighAccuracy: true });
    act(() => report(reading(53.8, -1.5, 12)));
    expect(result.current.position).toEqual({ lat: 53.8, lon: -1.5, accuracy: 12 });
    rerender({ on: false });
    expect(Geolocation.clearWatch).toHaveBeenCalledWith({ id: 'watch-1' });
    expect(result.current.position).toBeNull();
  });

  it('reports errors as messages, clearing them on the next reading', async () => {
    const { result } = renderHook(() => useLiveLocation(true));
    await waitFor(() => expect(Geolocation.watchPosition).toHaveBeenCalled());
    act(() => report(null, { code: 3 }));
    expect(result.current.error).toMatch(/took too long/);
    act(() => report(reading(53.8, -1.5)));
    expect(result.current.error).toBeNull();
  });

  it('pauses while the browser tab is hidden', async () => {
    renderHook(() => useLiveLocation(true));
    await waitFor(() => expect(Geolocation.watchPosition).toHaveBeenCalledOnce());
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(Geolocation.clearWatch).toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(Geolocation.watchPosition).toHaveBeenCalledTimes(2));
  });

  describe('in the Android app', () => {
    let onAppState: (state: { isActive: boolean }) => void = () => {};

    beforeEach(() => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(App.addListener).mockImplementation(((_event: string, listener: typeof onAppState) => {
        onAppState = listener;
        return Promise.resolve({ remove: vi.fn() });
      }) as unknown as typeof App.addListener);
    });

    it('asks for permission first, then watches', async () => {
      vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: 'prompt', coarseLocation: 'prompt' });
      vi.mocked(Geolocation.requestPermissions).mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });
      renderHook(() => useLiveLocation(true));
      await waitFor(() => expect(Geolocation.watchPosition).toHaveBeenCalled());
      expect(Geolocation.requestPermissions).toHaveBeenCalledWith({ permissions: ['location'] });
    });

    it('says so when permission is refused', async () => {
      vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });
      vi.mocked(Geolocation.requestPermissions).mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });
      const { result } = renderHook(() => useLiveLocation(true));
      await waitFor(() => expect(result.current.error).toMatch(/blocked/));
      expect(Geolocation.watchPosition).not.toHaveBeenCalled();
    });

    it('pauses while the app is in the background', async () => {
      vi.mocked(Geolocation.checkPermissions).mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });
      renderHook(() => useLiveLocation(true));
      await waitFor(() => expect(Geolocation.watchPosition).toHaveBeenCalledOnce());
      act(() => onAppState({ isActive: false }));
      expect(Geolocation.clearWatch).toHaveBeenCalled();
      act(() => onAppState({ isActive: true }));
      await waitFor(() => expect(Geolocation.watchPosition).toHaveBeenCalledTimes(2));
    });
  });
});
