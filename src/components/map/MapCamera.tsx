import { useMapCamera } from './useMapCamera';

type MapCameraProps = Parameters<typeof useMapCamera>[0];

/** Runs useMapCamera inside the MapContainer; draws nothing */
export const MapCamera = (props: MapCameraProps) => {
  useMapCamera(props);
  return null;
};
