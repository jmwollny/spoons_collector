import { Geolocation } from '@capacitor/geolocation';

export type Position = { lat: number; lon: number };

// Error codes from @capacitor/geolocation (Android) and the browser's
// GeolocationPositionError codes (1 = denied, 2 = unavailable, 3 = timeout)
const DENIED = ['OS-PLUG-GLOC-0003', 'OS-PLUG-GLOC-0009', 1];
const SERVICES_OFF = ['OS-PLUG-GLOC-0007', 'OS-PLUG-GLOC-0016', 'OS-PLUG-GLOC-0017', 2];
const TIMED_OUT = ['OS-PLUG-GLOC-0010', 3];

const friendlyMessage = (error: unknown) => {
  const code = (error as { code?: string | number })?.code;
  if (code !== undefined && DENIED.includes(code)) {
    return 'Location access is blocked. Allow it for this app in your settings to use Near me.';
  }
  if (code !== undefined && SERVICES_OFF.includes(code)) {
    return "Couldn't find your location. Check location is turned on.";
  }
  if (code !== undefined && TIMED_OUT.includes(code)) {
    return 'Finding your location took too long. Try again.';
  }
  return "Couldn't find your location.";
};

/**
 * The device's current position. In the Android app this asks for location
 * permission the first time; in a browser, the browser asks.
 * Throws an Error with a message fit to show the user.
 */
export const getCurrentLocation = async (): Promise<Position> => {
  try {
    const position = await Geolocation.getCurrentPosition({
      // A rough fix is plenty for finding the nearest pub, and much quicker
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 60000,
    });
    return { lat: position.coords.latitude, lon: position.coords.longitude };
  } catch (error) {
    throw new Error(friendlyMessage(error));
  }
};
