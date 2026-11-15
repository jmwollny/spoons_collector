/**
 * Stand-ins for react-leaflet and react-leaflet-cluster, for tests: jsdom
 * can't run Leaflet's map. Markers render as buttons (named by their
 * title, clicked through their click handler) so tests can find and use
 * them; lines and circles render as elements describing themselves.
 *
 * Use in a test file:
 *   vi.mock('react-leaflet', () => import('../../test/leafletStub'));
 *   vi.mock('react-leaflet-cluster', () => import('../../test/leafletStub').then((m) => ({ default: m.MarkerClusterGroup })));
 */
import { vi } from 'vitest';
import type { ReactNode } from 'react';

type LatLng = [number, number];

/** The fake map that useMap returns; tests can inspect its calls */
export const fakeMap = {
  zoom: 6,
  container: document.createElement('div'),
  getZoom: vi.fn(() => fakeMap.zoom),
  getContainer: vi.fn(() => fakeMap.container),
  invalidateSize: vi.fn(),
  scrollWheelZoom: { enable: vi.fn(), disable: vi.fn() },
  setView: vi.fn(),
  panTo: vi.fn(),
  fitBounds: vi.fn(),
  // Pretend pixels and degrees are the same, so offsets are easy to check
  project: vi.fn(([lat, lon]: LatLng) => ({
    x: lon,
    y: lat,
    add: ([dx, dy]: LatLng) => ({ x: lon + dx, y: lat + dy }),
  })),
  unproject: vi.fn((point: { x: number; y: number }) => [point.y, point.x]),
};

export const resetFakeMap = () => {
  fakeMap.zoom = 6;
  fakeMap.container = document.createElement('div');
  for (const value of Object.values(fakeMap)) {
    if (typeof value === 'function' && 'mockClear' in value) value.mockClear();
  }
  fakeMap.scrollWheelZoom.enable.mockClear();
  fakeMap.scrollWheelZoom.disable.mockClear();
};

export const useMap = () => fakeMap;

export const MapContainer = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div data-testid="map" className={className}>
    {children}
  </div>
);

export const TileLayer = ({ url }: { url: string }) => <div data-testid="tiles" data-url={url} />;

export const Marker = ({
  title,
  position,
  icon,
  zIndexOffset,
  eventHandlers,
}: {
  title?: string;
  position: LatLng;
  icon?: { options: { html?: string; className?: string } };
  zIndexOffset?: number;
  eventHandlers?: { click?: () => void };
}) => (
  <button
    type="button"
    data-testid="marker"
    data-position={position.join(',')}
    data-icon={icon?.options.html}
    data-z={zIndexOffset}
    onClick={() => eventHandlers?.click?.()}
  >
    {title}
  </button>
);

export const Polyline = ({ positions }: { positions: LatLng[] }) => (
  <div data-testid="line" data-positions={JSON.stringify(positions)} />
);

export const Circle = ({ center, radius }: { center: LatLng; radius: number }) => (
  <div data-testid="accuracy-circle" data-center={center.join(',')} data-radius={radius} />
);

export const CircleMarker = ({ center, children }: { center: LatLng; children?: ReactNode }) => (
  <div data-testid="you-are-here" data-center={center.join(',')}>
    {children}
  </div>
);

export const Tooltip = ({ children }: { children: ReactNode }) => <span>{children}</span>;

export const MarkerClusterGroup = ({ children }: { children: ReactNode }) => (
  <div data-testid="cluster-group">{children}</div>
);
