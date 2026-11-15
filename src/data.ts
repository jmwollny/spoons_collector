import spoons from '../assets/spoons_enriched.json';
import type { PubLocation } from './types';

// The app identifies pubs by Wetherspoon's own id (jdwId) rather than the OSM
// id, which changes whenever a mapper redraws a pub and would orphan the
// visits recorded against it. The pipeline warns about any pub without one.
export const locations: PubLocation[] = spoons
  .filter((spoon) => spoon.jdwId)
  .map(({ id, jdwId, ...spoon }) => ({ ...spoon, id: jdwId, osmId: id }));

export const pubsById = new Map(locations.map((location) => [location.id, location]));

export const regions = Array.from(new Set(locations.map((location) => location.region))).sort();

// The map opens showing every pub
export const initialMapBounds: [[number, number], [number, number]] = [
  [
    Math.min(...locations.map((location) => location.lat)),
    Math.min(...locations.map((location) => location.lon)),
  ],
  [
    Math.max(...locations.map((location) => location.lat)),
    Math.max(...locations.map((location) => location.lon)),
  ],
];
