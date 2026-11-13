/// <reference types="leaflet.markercluster" />
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import './Map.css';
import { useEffect, useRef } from 'react';

type Location = {
  id: number;
  name: string;
  city: string;
  lon: number;
  lat: number;
  rarity: string;
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

function MapContent({
  locations,
  visitedLocationIds,
  selectedLocationId,
  onLocationSelect,
}: Omit<MapProps, 'initialBounds' | 'userPosition'>) {
  const map = useMap();

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
}: MapProps) {
  return (
    <div className="map-shell">
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
        />
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
