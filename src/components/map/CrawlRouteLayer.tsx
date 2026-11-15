import { useEffect } from 'react';
import { Marker, Polyline, useMap } from 'react-leaflet';
import { fitPadding, getCrawlIcon } from './mapIcons';

/** A crawl's route, ready to draw */
export type CrawlRoute = {
  // Where the crawl starts, when that isn't its first pub
  start: { lat: number; lon: number; label: string } | null;
  // The stops shown (hidden treasure-hunt stops are left out), numbered by
  // their place on the crawl
  stops: Array<{ pubId: number; number: number; lat: number; lon: number; name: string; done: boolean }>;
  // The route along real streets between the stops, once fetched
  streetPath?: Array<[number, number]> | null;
};

type CrawlRouteLayerProps = {
  route: CrawlRoute;
  // Changes whenever the map should zoom to show the whole route
  fitKey: number;
  onSelect: (pubId: number) => void;
};

/**
 * The crawl's route through numbered stops: along the streets once fetched
 * (dashed only for the leg from a start that isn't a pub), otherwise a
 * dashed straight line
 */
export const CrawlRouteLayer = ({ route, fitKey, onSelect }: CrawlRouteLayerProps) => {
  const map = useMap();
  const points: Array<[number, number]> = [
    ...(route.start ? [[route.start.lat, route.start.lon] as [number, number]] : []),
    ...route.stops.map((stop) => [stop.lat, stop.lon] as [number, number]),
  ];

  const firstStop = route.stops[0];
  const lines: Array<{ positions: Array<[number, number]>; dashed: boolean }> = route.streetPath
    ? [
        ...(route.start && firstStop
          ? [{ positions: [[route.start.lat, route.start.lon], [firstStop.lat, firstStop.lon]] as Array<[number, number]>, dashed: true }]
          : []),
        { positions: route.streetPath, dashed: false },
      ]
    : [{ positions: points, dashed: true }];

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
      {lines.map((line, index) => (
        <Polyline
          key={index}
          positions={line.positions}
          pathOptions={{ color: '#db2777', weight: 4, opacity: 0.8, dashArray: line.dashed ? '8 8' : undefined }}
          interactive={false}
        />
      ))}
      {route.start && (
        <Marker
          position={[route.start.lat, route.start.lon]}
          icon={getCrawlIcon('🏁', 'start')}
          zIndexOffset={1900}
          title={`Start: ${route.start.label}`}
        />
      )}
      {route.stops.map((stop) => (
        <Marker
          key={stop.pubId}
          position={[stop.lat, stop.lon]}
          icon={getCrawlIcon(stop.done ? '✓' : String(stop.number), stop.done ? 'done' : 'stop')}
          zIndexOffset={2000}
          title={`${stop.number}. ${stop.name}`}
          eventHandlers={{ click: () => onSelect(stop.pubId) }}
        />
      ))}
    </>
  );
};
