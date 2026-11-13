import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './Map.css';
import { useEffect } from 'react';

type Location = {
  id: number;
  name: string;
  city: string;
  postcode: string;
  lon: number;
  lat: number;
  website: string;
  menu: string;
  region: string;
};

interface MapProps {
  locations: Location[];
  visitedLocationIds: Set<number>;
  selectedLocationId: number;
  onLocationSelect: (locationId: number) => void;
  mapCenter: [number, number];
  // Where the user is, once they've used Near me
  userPosition?: { lat: number; lon: number } | null;
}

const DEFAULT_ZOOM = 12;

function MapContent({
  locations,
  visitedLocationIds,
  selectedLocationId,
  onLocationSelect,
}: Omit<MapProps, 'mapCenter'>) {
  const map = useMap();

  const selectedLocation = locations.find(
    (location) => location.id === selectedLocationId,
  );
  const selectedLat = selectedLocation?.lat;
  const selectedLon = selectedLocation?.lon;

  // Zoom to the selected location when it changes. Keyed on the coordinates
  // rather than `locations`, which is a new array on every search keystroke or
  // filter change and would otherwise undo the user's own panning and zooming.
  useEffect(() => {
    if (selectedLat !== undefined && selectedLon !== undefined) {
      map.setView([selectedLat, selectedLon], DEFAULT_ZOOM);
    }
  }, [selectedLat, selectedLon, map]);

  const createMarkerIcon = (isVisited: boolean, isSelected: boolean) =>
    L.divIcon({
      className: 'spoon-marker-icon',
      html: `<div class="spoon-marker ${isVisited ? 'visited' : ''} ${isSelected ? 'active' : ''}"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

  const onMarkerClicked = (evt: any, locationId: number) => {
    onLocationSelect(locationId); // Call the callback to update the selected location
    map.flyTo(evt.latlng, DEFAULT_ZOOM, {
      animate: true,
      duration: 1.5, // Animation duration in seconds
    });
  };

  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {locations.map((location) => {
        const isVisited = visitedLocationIds.has(location.id);
        const isSelected = selectedLocationId === location.id;

        return (
          <Marker
            key={location.id}
            position={[location.lat, location.lon]}
            icon={createMarkerIcon(isVisited, isSelected)}
            eventHandlers={{
              click: (evt) => onMarkerClicked(evt, location.id),
            }}
          >
            {/* <Popup>
              <div className="map-popup">
                <strong>{location.name}</strong>
                <span>
                  {location.city} · {location.region}
                </span>
              </div>
            </Popup> */}
          </Marker>
        );
      })}
    </>
  );
}

export function Map({
  locations,
  visitedLocationIds,
  selectedLocationId,
  onLocationSelect,
  mapCenter,
  userPosition,
}: MapProps) {
  return (
    <div className="map-shell">
      <MapContainer
        center={mapCenter}
        zoom={DEFAULT_ZOOM}
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
    </div>
  );
}
