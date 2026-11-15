import { useState } from 'react';
import type { PubLocation } from '../types';
import { distanceMiles } from '../utils';
import { getCurrentLocation, type Position } from '../location';

/**
 * Near me: finds the user, once, and the nearest pub they haven't visited.
 * `onFound` decides what to do with it (select it, sort the list...).
 */
export const useNearMe = (
  locations: PubLocation[],
  visitedLocationIds: Set<number>,
  onFound: (position: Position, nearestPubId: number | null) => void,
) => {
  const [userPosition, setUserPosition] = useState<Position | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const nearMe = async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const position = await getCurrentLocation();
      const nearest = locations
        .filter((location) => !visitedLocationIds.has(location.id))
        .reduce<{ id: number; miles: number } | null>((closest, location) => {
          const miles = distanceMiles(position.lat, position.lon, location.lat, location.lon);
          return !closest || miles < closest.miles ? { id: location.id, miles } : closest;
        }, null);
      setUserPosition(position);
      onFound(position, nearest?.id ?? null);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : String(error));
    } finally {
      setLocating(false);
    }
  };

  return { userPosition, locating, locationError, nearMe };
};
