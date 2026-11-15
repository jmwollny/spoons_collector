import { useEffect } from 'react';
import { Marker, Polyline, useMap } from 'react-leaflet';
import { fitPadding, getCrawlIcon } from './mapIcons';

/** A crawl's route, ready to draw */
export type CrawlRoute = {
  // Where the crawl starts, when that isn't its first pub
  start: { lat: number; lon: number; label: string } | null;
  stops: Array<{ pubId: number; lat: number; lon: number; name: string; done: boolean }>;
};

type CrawlRouteLayerProps = {
  route: CrawlRoute;
  // Changes whenever the map should zoom to show the whole route
  fitKey: number;
  onSelect: (pubId: number) => void;
};

/** The crawl's route: a dashed line through numbered stops */
export const CrawlRouteLayer = ({ route, fitKey, onSelect }: CrawlRouteLayerProps) => {
  const map = useMap();
  const points: Array<[number, number]> = [
    ...(route.start ? [[route.start.lat, route.start.lon] as [number, number]] : []),
    ...route.stops.map((stop) => [stop.lat, stop.lon] as [number, number]),
  ];

  // Zoom to the whole route when asked: on planning it, or Show route
  useEffect(() => {
    if (fitKey > 0 && points.length > 0) {
      map.fitBounds(points, { ...fitPadding(), maxZoom: 15 });
    }
    // Only when asked, not whenever a stop is ticked off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);

  return (
    <>
      <Polyline
        positions={points}
        pathOptions={{ color: '#db2777', weight: 4, opacity: 0.8, dashArray: '8 8' }}
        interactive={false}
      />
      {route.start && (
        <Marker
          position={[route.start.lat, route.start.lon]}
          icon={getCrawlIcon('🏁', 'start')}
          zIndexOffset={1900}
          title={`Start: ${route.start.label}`}
        />
      )}
      {route.stops.map((stop, index) => (
        <Marker
          key={stop.pubId}
          position={[stop.lat, stop.lon]}
          icon={getCrawlIcon(stop.done ? '✓' : String(index + 1), stop.done ? 'done' : 'stop')}
          zIndexOffset={2000}
          title={`${index + 1}. ${stop.name}`}
          eventHandlers={{ click: () => onSelect(stop.pubId) }}
        />
      ))}
    </>
  );
};
