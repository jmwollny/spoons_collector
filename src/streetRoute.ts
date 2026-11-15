import { crawlStartTime, scheduleStops, travelMinutes, type Crawl, type TravelMode } from './crawl';

/**
 * Routes along real streets, from the FOSSGIS routing service at
 * openstreetmap.de (the one openstreetmap.org's own directions use), built
 * on OpenStreetMap data.
 *
 * Privacy: only pubs' locations are sent. The leg from the user's own
 * location (or a town centre) to the first pub stays a straight line.
 */
const ROUTERS: Record<TravelMode, string> = {
  walk: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  drive: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
};

const METRES_PER_MILE = 1609.344;
const TIMEOUT_MS = 15_000;

export type StreetRoute = {
  // The route as [lat, lon] points, for drawing
  path: Array<[number, number]>;
  // Each leg between consecutive pubs
  legs: Array<{ miles: number; minutes: number }>;
};

type OsrmResponse = {
  code: string;
  routes?: Array<{
    geometry: { coordinates: Array<[number, number]> };
    legs: Array<{ distance: number; duration: number }>;
  }>;
};

/** The street route through some points in order, or throws */
export const fetchStreetRoute = async (
  points: Array<{ lat: number; lon: number }>,
  mode: TravelMode,
): Promise<StreetRoute> => {
  const coordinates = points.map((point) => `${point.lon.toFixed(6)},${point.lat.toFixed(6)}`).join(';');
  const response = await fetch(
    `${ROUTERS[mode]}/${coordinates}?overview=full&geometries=geojson&steps=false`,
    { signal: AbortSignal.timeout(TIMEOUT_MS) },
  );
  if (!response.ok) {
    throw new Error(`Routing failed: HTTP ${response.status}`);
  }
  const data = (await response.json()) as OsrmResponse;
  const route = data.routes?.[0];
  if (data.code !== 'Ok' || !route) {
    throw new Error(`Routing failed: ${data.code}`);
  }
  return {
    path: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    legs: route.legs.map((leg) => ({
      miles: leg.distance / METRES_PER_MILE,
      // Rounded up to 5 minutes, like the straight-line estimates
      minutes: Math.ceil(leg.duration / 60 / 5) * 5,
    })),
  };
};

/**
 * The crawl with its legs between pubs measured along the streets, and its
 * arrival times and meals worked out again from them
 */
export const applyStreetRoute = (crawl: Crawl, route: StreetRoute): Crawl => {
  const legs = crawl.stops.map((stop, index) => {
    const streetLeg = index > 0 ? route.legs[index - 1] : undefined;
    return {
      pubId: stop.pubId,
      wasNew: stop.wasNew,
      legMiles: streetLeg?.miles ?? stop.legMiles,
      legMinutes: streetLeg?.minutes ?? travelMinutes(stop.legMiles, crawl.mode),
    };
  });
  return {
    ...crawl,
    stops: scheduleStops(legs, crawlStartTime(crawl), crawl.stayMinutes),
    streetPath: route.path,
  };
};
