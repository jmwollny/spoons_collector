import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePhotoUrl } from './usePhotoUrl';
import { loadPhotoUrl } from '../photos';

vi.mock('../photos', () => ({ loadPhotoUrl: vi.fn() }));

beforeEach(() => {
  vi.mocked(loadPhotoUrl).mockReset().mockResolvedValue('blob:v1');
  URL.revokeObjectURL = vi.fn();
});

describe('usePhotoUrl', () => {
  it('loads the photo of a visit that has one, releasing it after', async () => {
    const { result, unmount } = renderHook(() => usePhotoUrl('v1', true));
    await waitFor(() => expect(result.current).toBe('blob:v1'));
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:v1');
  });

  it("doesn't look for a photo a visit doesn't have", () => {
    const { result } = renderHook(() => usePhotoUrl('v1', false));
    expect(result.current).toBeNull();
    expect(loadPhotoUrl).not.toHaveBeenCalled();
  });

  it('releases a photo that arrives after it is no longer wanted', async () => {
    let finish: (url: string) => void = () => {};
    vi.mocked(loadPhotoUrl).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { unmount } = renderHook(() => usePhotoUrl('v1', true));
    unmount();
    finish('blob:late');
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:late'));
  });

  it('forgets the photo when the visit loses it', async () => {
    const { result, rerender } = renderHook(({ has }) => usePhotoUrl('v1', has), { initialProps: { has: true } });
    await waitFor(() => expect(result.current).toBe('blob:v1'));
    rerender({ has: false });
    expect(result.current).toBeNull();
  });
});
