import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useNearMe } from './useNearMe';
import { getCurrentLocation } from '../location';
import { samplePubs } from '../test/fixtures';

vi.mock('../location', () => ({ getCurrentLocation: vi.fn() }));

beforeEach(() => {
  vi.mocked(getCurrentLocation).mockReset();
});

describe('useNearMe', () => {
  it('finds the user and the nearest pub they have not visited', async () => {
    // In Leeds, having visited the Cuthbert Brodrick
    vi.mocked(getCurrentLocation).mockResolvedValue({ lat: 53.8018, lon: -1.5478 });
    const onFound = vi.fn();
    const { result } = renderHook(() => useNearMe(samplePubs, new Set([1]), onFound));
    await act(() => result.current.nearMe());
    expect(onFound).toHaveBeenCalledWith({ lat: 53.8018, lon: -1.5478 }, 2);
    expect(result.current.userPosition).toEqual({ lat: 53.8018, lon: -1.5478 });
    expect(result.current.locating).toBe(false);
  });

  it('reports no pub when every one is visited', async () => {
    vi.mocked(getCurrentLocation).mockResolvedValue({ lat: 53.8, lon: -1.5 });
    const onFound = vi.fn();
    const { result } = renderHook(() => useNearMe(samplePubs, new Set([1, 2, 3, 4]), onFound));
    await act(() => result.current.nearMe());
    expect(onFound).toHaveBeenCalledWith({ lat: 53.8, lon: -1.5 }, null);
  });

  it('shows it is working', async () => {
    let finish: (value: { lat: number; lon: number }) => void = () => {};
    vi.mocked(getCurrentLocation).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { result } = renderHook(() => useNearMe(samplePubs, new Set(), vi.fn()));
    let search: Promise<void>;
    act(() => {
      search = result.current.nearMe();
    });
    expect(result.current.locating).toBe(true);
    await act(async () => {
      finish({ lat: 53.8, lon: -1.5 });
      await search;
    });
    expect(result.current.locating).toBe(false);
  });

  it("keeps the error when the user can't be found", async () => {
    vi.mocked(getCurrentLocation).mockRejectedValue(new Error('Location access is blocked.'));
    const onFound = vi.fn();
    const { result } = renderHook(() => useNearMe(samplePubs, new Set(), onFound));
    await act(() => result.current.nearMe());
    expect(result.current.locationError).toBe('Location access is blocked.');
    expect(onFound).not.toHaveBeenCalled();
  });

  it('keeps any other failure as text', async () => {
    vi.mocked(getCurrentLocation).mockImplementation(async () => {
      throw 'odd failure';
    });
    const { result } = renderHook(() => useNearMe(samplePubs, new Set(), vi.fn()));
    await act(() => result.current.nearMe());
    expect(result.current.locationError).toBe('odd failure');
  });
});
