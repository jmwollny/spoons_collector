/// <reference types="leaflet.markercluster" />
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import './Map.css';
import './Crawl.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';

type Location = {
  id: number;
  name: string;
  city: string;
  lon: number;
  lat: number;
  rarity: string;
};

/** A crawl's route, ready to draw */
export type CrawlRoute = {
  // Where the crawl starts, when that isn't its first pub
  start: { lat: number; lon: number; label: string } | null;
  stops: Array<{ pubId: number; lat: number; lon: number; name: string; done: boolean }>;
};

interface MapProps {
  locations: Location[];
  visitedLocationIds: Set<number>;
  selectedLocationId: number;
  onLocationSelect: (locationId: number) => void;
  // Area shown when the map first opens: the whole country
  initialBounds: L.LatLngBoundsExpression;
  // Where the user is, once they've used Near me
  userPosition?: { lat: number; lon: number } | null;
  // Shown on top of the map, e.g. the selected pub's bar on phones
  children?: ReactNode;
  // Whether the map fills the screen
  expanded: boolean;
  onToggleExpanded: () => void;
  // Near me, shown on the map while it fills the screen
  onNearMe: () => void;
  locating: boolean;
  locationError: string | null;
  // The crawl under way, if any
  crawlRoute: CrawlRoute | null;
  // Changes whenever the map should zoom to show the whole crawl
  routeFitKey: number;
}

// Zoom used when a pub is selected: about a town's width
const PUB_ZOOM = 12;
// From this zoom in, every pub is shown individually rather than grouped
const UNGROUPED_FROM_ZOOM = 10;

const RARITY_LEGEND = ['Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'];

// Marker icons are shared: one per combination of rarity, visited and
// selected, rather than a new icon for each of 800 markers on every render
const iconCache = new globalThis.Map<string, L.DivIcon>();
const getMarkerIcon = (rarity: string, isVisited: boolean, isSelected: boolean) => {
  const key = `${rarity}|${isVisited}|${isSelected}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const classes = [
      'spoon-marker',
      `rarity-${rarity.toLowerCase()}`,
      isVisited ? 'visited' : '',
      isSelected ? 'active' : '',
    ].join(' ');
    icon = L.divIcon({
      className: 'spoon-marker-icon',
      html: `<div class="${classes}"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    iconCache.set(key, icon);
  }
  return icon;
};

// A group of pubs shown as one bubble with a count
const createClusterIcon = (cluster: L.MarkerCluster) => {
  const count = cluster.getChildCount();
  const size = count < 10 ? 30 : count < 50 ? 36 : 44;
  return L.divIcon({
    className: 'spoon-cluster-icon',
    html: `<div class="spoon-cluster" style="width:${size}px;height:${size}px">${count}</div>`,
    iconSize: [size, size],
  });
};

/**
 * Padding for zooming the map to fit a set of points, keeping clear of what
 * sits on top of the map: the pub card in the top-right corner on wide
 * screens, the pub bar along the bottom on phones.
 */
const fitPadding = (): L.FitBoundsOptions =>
  window.matchMedia('(max-width: 600px)').matches
    ? { paddingTopLeft: [40, 40], paddingBottomRight: [40, 100] }
    : { paddingTopLeft: [50, 50], paddingBottomRight: [200, 50] };

// Numbered crawl markers, shared like the pub markers
const crawlIconCache = new globalThis.Map<string, L.DivIcon>();
const getCrawlIcon = (label: string, kind: 'stop' | 'done' | 'start') => {
  const key = `${kind}|${label}`;
  let icon = crawlIconCache.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: 'crawl-marker-icon',
      html: `<div class="crawl-marker is-${kind}">${label}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    crawlIconCache.set(key, icon);
  }
  return icon;
};

/** The crawl's route: a dashed line through numbered stops */
function CrawlRouteLayer({
  route,
  fitKey,
  onSelect,
}: {
  route: CrawlRoute;
  fitKey: number;
  onSelect: (pubId: number) => void;
}) {
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
}

type MapContentProps = Pick<
  MapProps,
  'locations' | 'visitedLocationIds' | 'selectedLocationId' | 'onLocationSelect' | 'userPosition' | 'expanded'
>;

function MapContent({
  locations,
  visitedLocationIds,
  selectedLocationId,
  onLocationSelect,
  userPosition,
  expanded,
}: MapContentProps) {
  const map = useMap();

  // Leaflet needs telling when the map changes size. Scroll-wheel zoom is
  // off on the page, where the wheel should scroll the page, but on when
  // the map fills the screen and there's no page to scroll.
  useEffect(() => {
    map.invalidateSize();
    if (expanded) {
      map.scrollWheelZoom.enable();
    } else {
      map.scrollWheelZoom.disable();
    }
  }, [expanded, map]);

  const selectedLocation = locations.find(
    (location) => location.id === selectedLocationId,
  );
  const selectedLat = selectedLocation?.lat;
  const selectedLon = selectedLocation?.lon;

  // The pub the map was last centred on. It starts as the pub selected when
  // the app opens, so the map opens on the whole country rather than jumping
  // to that pub, and only moves once the user picks one.
  const centredOn = useRef(
    selectedLat !== undefined ? `${selectedLat},${selectedLon}` : null,
  );

  // Zoom to the selected location when it changes. Keyed on the coordinates
  // rather than `locations`, which is a new array on every search keystroke or
  // filter change and would otherwise undo the user's own panning and zooming.
  useEffect(() => {
    if (selectedLat === undefined || selectedLon === undefined) {
      return;
    }
    const key = `${selectedLat},${selectedLon}`;
    if (centredOn.current === key) {
      return;
    }
    centredOn.current = key;
    map.setView([selectedLat, selectedLon], PUB_ZOOM);
  }, [selectedLat, selectedLon, map]);

  // After Near me, zoom to show both the user and the pub it picked.
  // Declared after the effect above so this view wins when both change.
  // A new position object arrives each time Near me is used.
  useEffect(() => {
    if (!userPosition || selectedLat === undefined || selectedLon === undefined) {
      return;
    }
    map.fitBounds(
      [
        [userPosition.lat, userPosition.lon],
        [selectedLat, selectedLon],
      ],
      { ...fitPadding(), maxZoom: 15 },
    );
    // Only when the position changes, not when the user picks another pub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPosition, map]);

  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MarkerClusterGroup
        chunkedLoading
        showCoverageOnHover={false}
        maxClusterRadius={45}
        disableClusteringAtZoom={UNGROUPED_FROM_ZOOM}
        iconCreateFunction={createClusterIcon}
      >
        {locations.map((location) => {
          const isVisited = visitedLocationIds.has(location.id);
          const isSelected = selectedLocationId === location.id;

          return (
            <Marker
              key={location.id}
              position={[location.lat, location.lon]}
              icon={getMarkerIcon(location.rarity, isVisited, isSelected)}
              zIndexOffset={isSelected ? 1000 : 0}
              title={`${location.name}, ${location.city}`}
              eventHandlers={{
                click: () => onLocationSelect(location.id),
              }}
            />
          );
        })}
      </MarkerClusterGroup>
    </>
  );
}

export function Map({
  locations,
  visitedLocationIds,
  selectedLocationId,
  onLocationSelect,
  initialBounds,
  userPosition,
  children,
  expanded,
  onToggleExpanded,
  onNearMe,
  locating,
  locationError,
  crawlRoute,
  routeFitKey,
}: MapProps) {
  // On phones the key folds away behind a button while the map fills the screen
  const [isKeyOpen, setIsKeyOpen] = useState(false);
  // The location error the user closed, so it stays closed until a new one
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  return (
    <div className={`map-shell ${expanded ? 'is-expanded' : ''} ${isKeyOpen ? 'key-open' : ''}`}>
      <div className="map-area">
        <MapContainer
          bounds={initialBounds}
          boundsOptions={{ padding: [16, 16] }}
          scrollWheelZoom={false}
          className="leaflet-map"
        >
          <MapContent
            locations={locations}
            visitedLocationIds={visitedLocationIds}
            selectedLocationId={selectedLocationId}
            onLocationSelect={onLocationSelect}
            userPosition={userPosition}
            expanded={expanded}
          />
          {crawlRoute && (
            <CrawlRouteLayer route={crawlRoute} fitKey={routeFitKey} onSelect={onLocationSelect} />
          )}
          {userPosition && (
            <CircleMarker
              center={[userPosition.lat, userPosition.lon]}
              radius={8}
              pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}
            >
              <Tooltip>You are here</Tooltip>
            </CircleMarker>
          )}
        </MapContainer>

        <div className="map-controls">
          <button
            type="button"
            className="map-control-button"
            onClick={onToggleExpanded}
            aria-label={expanded ? 'Shrink map' : 'Expand map to full screen'}
            title={expanded ? 'Shrink map (Esc)' : 'Full screen'}
          >
            {expanded ? '✕' : '⛶'}
          </button>
          {expanded && (
            <button
              type="button"
              className="map-control-button map-near-me"
              onClick={onNearMe}
              disabled={locating}
              aria-label="Find the nearest pubs you haven't visited"
            >
              {locating ? 'Finding you…' : '📍 Near me'}
            </button>
          )}
        </div>

        {expanded && (
          <button
            type="button"
            className="map-key-toggle"
            onClick={() => setIsKeyOpen((open) => !open)}
            aria-expanded={isKeyOpen}
          >
            Key
          </button>
        )}

        {expanded && locationError && locationError !== dismissedError && (
          <div className="map-toast" role="alert">
            <span>{locationError}</span>
            <button
              type="button"
              onClick={() => setDismissedError(locationError)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {children}
      </div>
      <ul className="map-legend" aria-label="Map key">
        {RARITY_LEGEND.map((rarity) => (
          <li key={rarity}>
            <span className={`spoon-marker rarity-${rarity.toLowerCase()}`} />
            {rarity}
          </li>
        ))}
        <li>
          <span className="spoon-marker visited" />
          Visited
        </li>
      </ul>
    </div>
  );
}
