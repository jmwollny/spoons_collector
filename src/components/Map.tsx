import { useState, type ReactNode } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import type L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import './Map.css';
import './Crawl.css';
import { MapCamera } from './map/MapCamera';
import { PubMarkers, type MapPub } from './map/PubMarkers';
import { CrawlRouteLayer, type CrawlRoute } from './map/CrawlRouteLayer';
import { UserLocationLayer } from './map/UserLocationLayer';
import { MapControls } from './map/MapControls';
import { MapLegend } from './map/MapLegend';
import { MapToast } from './map/MapToast';

export type { CrawlRoute } from './map/CrawlRouteLayer';

interface MapProps {
  locations: MapPub[];
  visitedLocationIds: Set<number>;
  selectedLocationId: number;
  onLocationSelect: (locationId: number) => void;
  // Area shown when the map first opens: the whole country
  initialBounds: L.LatLngBoundsExpression;
  // Where the user is, once they've used Near me
  userPosition?: { lat: number; lon: number } | null;
  // Shown on top of the map, e.g. the selected pub's sheet on phones
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
  // Where the user is right now, while live location is on
  livePosition?: { lat: number; lon: number; accuracy: number } | null;
  // Changes whenever the map should zoom to show the whole crawl
  routeFitKey: number;
}

/** The map of pubs, with the crawl route, the user's position and controls */
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
  livePosition,
}: MapProps) {
  // On phones the key folds away behind a button while the map fills the screen
  const [isKeyOpen, setIsKeyOpen] = useState(false);
  const selected = locations.find((location) => location.id === selectedLocationId);

  return (
    <div className={`map-shell ${expanded ? 'is-expanded' : ''} ${isKeyOpen ? 'key-open' : ''}`}>
      <div className="map-area">
        <MapContainer
          bounds={initialBounds}
          boundsOptions={{ padding: [16, 16] }}
          scrollWheelZoom={false}
          className="leaflet-map"
        >
          <MapCamera selected={selected} userPosition={userPosition} expanded={expanded} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <PubMarkers
            pubs={locations}
            visitedIds={visitedLocationIds}
            selectedId={selectedLocationId}
            onSelect={onLocationSelect}
          />
          {crawlRoute && (
            <CrawlRouteLayer route={crawlRoute} fitKey={routeFitKey} onSelect={onLocationSelect} />
          )}
          <UserLocationLayer userPosition={userPosition} livePosition={livePosition} />
        </MapContainer>

        <MapControls
          expanded={expanded}
          onToggleExpanded={onToggleExpanded}
          onNearMe={onNearMe}
          locating={locating}
        />

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

        {/* Always mounted, so a dismissed message stays dismissed when the map
            shrinks and expands again; only shown while it fills the screen */}
        <MapToast message={expanded ? locationError : null} />

        {children}
      </div>
      <MapLegend />
    </div>
  );
}
