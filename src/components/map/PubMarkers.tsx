import { Marker } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { createClusterIcon, getMarkerIcon, UNGROUPED_FROM_ZOOM } from './mapIcons';

export type MapPub = {
  id: number;
  name: string;
  city: string;
  lon: number;
  lat: number;
  rarity: string;
};

type PubMarkersProps = {
  pubs: MapPub[];
  visitedIds: Set<number>;
  selectedId: number;
  onSelect: (pubId: number) => void;
};

/**
 * A marker for each pub, coloured by rarity, grouped into numbered bubbles
 * when zoomed out
 */
export const PubMarkers = ({ pubs, visitedIds, selectedId, onSelect }: PubMarkersProps) => (
  <MarkerClusterGroup
    chunkedLoading
    showCoverageOnHover={false}
    maxClusterRadius={45}
    disableClusteringAtZoom={UNGROUPED_FROM_ZOOM}
    iconCreateFunction={createClusterIcon}
  >
    {pubs.map((pub) => {
      const isSelected = pub.id === selectedId;
      return (
        <Marker
          key={pub.id}
          position={[pub.lat, pub.lon]}
          icon={getMarkerIcon(pub.rarity, visitedIds.has(pub.id), isSelected)}
          zIndexOffset={isSelected ? 1000 : 0}
          title={`${pub.name}, ${pub.city}`}
          eventHandlers={{ click: () => onSelect(pub.id) }}
        />
      );
    })}
  </MarkerClusterGroup>
);
