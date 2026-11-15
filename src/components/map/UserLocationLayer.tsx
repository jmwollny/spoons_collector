import { Circle, CircleMarker, Tooltip } from 'react-leaflet';

type UserLocationLayerProps = {
  // Where Near me found the user
  userPosition?: { lat: number; lon: number } | null;
  // Where the user is right now, while live location is on (accuracy in
  // metres). Shown instead of the Near me position.
  livePosition?: { lat: number; lon: number; accuracy: number } | null;
};

/** The blue "you are here" dot, with a circle showing how accurate it is */
export const UserLocationLayer = ({ userPosition, livePosition }: UserLocationLayerProps) => {
  const dot = livePosition ?? userPosition;
  return (
    <>
      {livePosition && (
        <Circle
          center={[livePosition.lat, livePosition.lon]}
          radius={livePosition.accuracy}
          pathOptions={{ color: '#2563eb', weight: 1, opacity: 0.4, fillOpacity: 0.1 }}
          interactive={false}
        />
      )}
      {dot && (
        <CircleMarker
          center={[dot.lat, dot.lon]}
          radius={8}
          pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}
        >
          <Tooltip>You are here</Tooltip>
        </CircleMarker>
      )}
    </>
  );
};
