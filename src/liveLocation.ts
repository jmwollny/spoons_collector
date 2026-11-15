import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Geolocation } from '@capacitor/geolocation';
import type { PubLocation } from './types';
import { distanceMiles } from './utils';
import { friendlyMessage } from './location';

export type LivePosition = {
  lat: number;
  lon: number;
  // Metres; how far out the reading may be
  accuracy: number;
};

const METRES_PER_MILE = 1609.344;

// Within this distance of a pub, you're at it
const ARRIVE_METRES = 60;
// ... and you've left once you're this far away. Wider than ARRIVE_METRES so
// GPS wobble at the door doesn't make the banner come and go.
const LEAVE_METRES = 120;
// Readings less accurate than this (common indoors) are ignored, so the
// wrong pub isn't suggested
const MAX_ACCURACY_METRES = 75;
// How long you have to stay at a pub before it counts, so walking past
// the door doesn't
export const DWELL_MS = 45_000;

const metresBetween = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  distanceMiles(a.lat, a.lon, b.lat, b.lon) * METRES_PER_MILE;

/**
 * Follows the device's position while `enabled`, pausing while the app is
 * in the background to save battery.
 */
export const useLiveLocation = (enabled: boolean) => {
  const [position, setPosition] = useState<LivePosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isForeground, setIsForeground] = useState(true);

  // In the Android app, follow the app going to the background and back;
  // in a browser, the tab being hidden and shown
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const listener = App.addListener('appStateChange', ({ isActive }) => setIsForeground(isActive));
      return () => {
        void listener.then((handle) => handle.remove());
      };
    }
    const onVisibility = () => setIsForeground(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!enabled || !isForeground) {
      return;
    }
    let watchId: string | null = null;
    let cancelled = false;

    const start = async () => {
      try {
        // Asks for permission the first time (in a browser, the browser asks)
        if (Capacitor.isNativePlatform()) {
          const status = await Geolocation.checkPermissions();
          if (status.location !== 'granted') {
            const requested = await Geolocation.requestPermissions({ permissions: ['location'] });
            if (requested.location !== 'granted') {
              throw { code: 1 };
            }
          }
        }
        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000, interval: 10000 },
          (reading, watchError) => {
            if (cancelled) return;
            if (watchError || !reading) {
              setError(friendlyMessage(watchError));
              return;
            }
            setError(null);
            setPosition({
              lat: reading.coords.latitude,
              lon: reading.coords.longitude,
              accuracy: reading.coords.accuracy,
            });
          },
        );
        if (cancelled) {
          void Geolocation.clearWatch({ id });
        } else {
          watchId = id;
        }
      } catch (startError) {
        if (!cancelled) setError(friendlyMessage(startError));
      }
    };
    void start();

    return () => {
      cancelled = true;
      if (watchId) void Geolocation.clearWatch({ id: watchId });
    };
  }, [enabled, isForeground]);

  return { position: enabled ? position : null, error: enabled ? error : null };
};

/** The nearest pub within `metres` of a position, if any */
const pubWithin = (
  position: LivePosition,
  locations: PubLocation[],
  metres: number,
): PubLocation | null => {
  let nearest: { pub: PubLocation; metres: number } | null = null;
  for (const pub of locations) {
    const distance = metresBetween(position, pub);
    if (distance <= metres && (!nearest || distance < nearest.metres)) {
      nearest = { pub, metres: distance };
    }
  }
  return nearest?.pub ?? null;
};

/**
 * The pub the user is at: within ARRIVE_METRES for DWELL_MS, on readings
 * accurate enough to trust. Stays set until they're LEAVE_METRES away.
 */
export const useArrival = (position: LivePosition | null, locations: PubLocation[]) => {
  // The pub the user is near, and since when
  const [candidate, setCandidate] = useState<{ pubId: number; since: number } | null>(null);
  const [arrivedPubId, setArrivedPubId] = useState<number | null>(null);
  const latest = useRef(position);

  useEffect(() => {
    latest.current = position;
    if (!position) {
      setCandidate(null);
      setArrivedPubId(null);
      return;
    }
    if (position.accuracy > MAX_ACCURACY_METRES) {
      return;
    }

    // Left the pub they were at?
    setArrivedPubId((current) => {
      if (current === null) return null;
      const pub = locations.find((location) => location.id === current);
      return pub && metresBetween(position, pub) <= LEAVE_METRES ? current : null;
    });

    const near = pubWithin(position, locations, ARRIVE_METRES);
    setCandidate((current) => {
      if (!near) return null;
      if (current?.pubId === near.id) return current;
      return { pubId: near.id, since: Date.now() };
    });
  }, [position, locations]);

  // Once the user has stayed DWELL_MS, they've arrived. A timer, because a
  // phone standing still may not send any more readings.
  useEffect(() => {
    if (!candidate) return;
    const timer = window.setTimeout(
      () => {
        const pub = locations.find((location) => location.id === candidate.pubId);
        const now = latest.current;
        if (pub && now && metresBetween(now, pub) <= LEAVE_METRES) {
          setArrivedPubId(candidate.pubId);
        }
      },
      Math.max(0, candidate.since + DWELL_MS - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [candidate, locations]);

  return arrivedPubId;
};
