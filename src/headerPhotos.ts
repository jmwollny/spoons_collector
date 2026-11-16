import type { PubLocation, VisitEntry } from './types';

// Enough to fill a wide screen's header: three of the mosaic's groups of
// one big photo and four small ones
export const HEADER_PHOTO_COUNT = 15;

/**
 * The pubs whose photos make up the header's mosaic: the user's own, most
 * recently visited first, then pubs spread evenly across the country to
 * fill it. Only pubs with a photo.
 * @param visits newest first, as the app keeps them
 */
export const pickHeaderPubs = (
  visits: VisitEntry[],
  locations: PubLocation[],
  pubsById: Map<number, PubLocation>,
  count = HEADER_PHOTO_COUNT,
): PubLocation[] => {
  const chosen: PubLocation[] = [];
  const seen = new Set<number>();
  for (const visit of visits) {
    if (chosen.length === count) return chosen;
    const pub = pubsById.get(visit.locationId);
    if (pub?.imgType && !seen.has(pub.id)) {
      seen.add(pub.id);
      chosen.push(pub);
    }
  }
  const others = locations.filter((pub) => pub.imgType && !seen.has(pub.id));
  const step = Math.max(1, Math.floor(others.length / Math.max(1, count - chosen.length)));
  for (let index = 0; chosen.length < count && index < others.length; index += step) {
    chosen.push(others[index]);
  }
  return chosen;
};
