import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Geolocation } from '@capacitor/geolocation';
import { friendlyMessage, getCurrentLocation } from './location';

vi.mock('@capacitor/geolocation', () => ({ Geolocation: { getCurrentPosition: vi.fn() } }));

beforeEach(() => {
  vi.mocked(Geolocation.getCurrentPosition).mockReset();
});

describe('getCurrentLocation', () => {
  it('returns the position, asking for a quick rough fix', async () => {
    vi.mocked(Geolocation.getCurrentPosition).mockResolvedValue({
      coords: { latitude: 53.8, longitude: -1.5 },
    } as Awaited<ReturnType<typeof Geolocation.getCurrentPosition>>);
    await expect(getCurrentLocation()).resolves.toEqual({ lat: 53.8, lon: -1.5 });
    expect(Geolocation.getCurrentPosition).toHaveBeenCalledWith(
      expect.objectContaining({ enableHighAccuracy: false }),
    );
  });

  it('turns failures into messages fit to show', async () => {
    vi.mocked(Geolocation.getCurrentPosition).mockRejectedValue({ code: 'OS-PLUG-GLOC-0003' });
    await expect(getCurrentLocation()).rejects.toThrow('Location access is blocked');
  });
});

describe('friendlyMessage', () => {
  it('explains each kind of failure, from Android or a browser', () => {
    expect(friendlyMessage({ code: 1 })).toMatch(/blocked/);
    expect(friendlyMessage({ code: 'OS-PLUG-GLOC-0016' })).toMatch(/Check location is turned on/);
    expect(friendlyMessage({ code: 2 })).toMatch(/Check location is turned on/);
    expect(friendlyMessage({ code: 3 })).toMatch(/took too long/);
    expect(friendlyMessage({ code: 'OS-PLUG-GLOC-0010' })).toMatch(/took too long/);
    expect(friendlyMessage(new Error('mystery'))).toBe("Couldn't find your location.");
    expect(friendlyMessage(undefined)).toBe("Couldn't find your location.");
  });
});
