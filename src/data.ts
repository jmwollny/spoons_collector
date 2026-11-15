// The pub data is fetched as a plain JSON file rather than bundled into the
// JavaScript: the app's code stays small, and the browser parses JSON much
// faster than the same data written as code
import pubDataUrl from '../assets/spoons_enriched.json?url';
import type { PubLocation } from './types';

/** A pub as the data pipeline writes it (see enrich.js) */
type RawSpoon = Omit<PubLocation, 'id' | 'osmId'> & {
  // OpenStreetMap id
  id: number;
  // Wetherspoon's own id; missing for the odd pub the pipeline couldn't match
  jdwId?: number | null;
};

export type PubData = {
  locations: PubLocation[];
  pubsById: Map<number, PubLocation>;
  regions: string[];
  // The area the map opens on: every pub
  initialMapBounds: [[number, number], [number, number]];
};

export const buildPubData = (spoons: RawSpoon[]): PubData => {
  // The app identifies pubs by Wetherspoon's own id (jdwId) rather than the
  // OSM id, which changes whenever a mapper redraws a pub and would orphan
  // the visits recorded against it. The pipeline warns about any pub
  // without one.
  const locations: PubLocation[] = spoons
    .filter((spoon): spoon is RawSpoon & { jdwId: number } => Boolean(spoon.jdwId))
    .map(({ id, jdwId, ...spoon }) => ({ ...spoon, id: jdwId, osmId: id }));

  return {
    locations,
    pubsById: new Map(locations.map((location) => [location.id, location])),
    regions: Array.from(new Set(locations.map((location) => location.region))).sort(),
    initialMapBounds: [
      [
        Math.min(...locations.map((location) => location.lat)),
        Math.min(...locations.map((location) => location.lon)),
      ],
      [
        Math.max(...locations.map((location) => location.lat)),
        Math.max(...locations.map((location) => location.lon)),
      ],
    ],
  };
};

/** Fetches the pub data. Throws if it can't be loaded. */
export const loadPubData = async (): Promise<PubData> => {
  const response = await fetch(pubDataUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return buildPubData((await response.json()) as RawSpoon[]);
};
