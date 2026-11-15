import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Map } from './Map';
import { resetFakeMap } from '../test/leafletStub';
import { samplePubs } from '../test/fixtures';

vi.mock('react-leaflet', () => import('../test/leafletStub'));
vi.mock('react-leaflet-cluster', () =>
  import('../test/leafletStub').then((module) => ({ default: module.MarkerClusterGroup })),
);

const renderMap = (overrides: Partial<React.ComponentProps<typeof Map>> = {}) => {
  const props = {
    locations: samplePubs,
    visitedLocationIds: new Set<number>(),
    selectedLocationId: 1,
    onLocationSelect: vi.fn(),
    initialBounds: [
      [50, -5],
      [58, 1],
    ] as [[number, number], [number, number]],
    expanded: false,
    onToggleExpanded: vi.fn(),
    onNearMe: vi.fn(),
    locating: false,
    locationError: null,
    crawlRoute: null,
    routeFitKey: 0,
    ...overrides,
  };
  render(
    <Map {...props}>
      <div>overlay</div>
    </Map>,
  );
  return props;
};

beforeEach(() => resetFakeMap());

describe('Map', () => {
  it('shows OpenStreetMap tiles, the pubs, the key and anything laid over it', () => {
    renderMap();
    expect(screen.getByTestId('tiles').dataset.url).toContain('tile.openstreetmap.org');
    expect(screen.getAllByTestId('marker')).toHaveLength(4);
    expect(screen.getByRole('list', { name: 'Map key' })).toBeInTheDocument();
    expect(screen.getByText('overlay')).toBeInTheDocument();
  });

  it('selects pubs from their markers', async () => {
    const props = renderMap();
    await userEvent.click(screen.getByRole('button', { name: 'The Counting House, Glasgow' }));
    expect(props.onLocationSelect).toHaveBeenCalledWith(4);
  });

  it('draws a crawl route when there is one', () => {
    renderMap({
      crawlRoute: {
        start: null,
        stops: [{ pubId: 1, lat: 53.8, lon: -1.5, name: 'The Cuthbert Brodrick', done: false }],
      },
    });
    expect(screen.getByTestId('line')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1. The Cuthbert Brodrick' })).toBeInTheDocument();
  });

  it('expands to full screen', async () => {
    const props = renderMap();
    await userEvent.click(screen.getByRole('button', { name: 'Expand map to full screen' }));
    expect(props.onToggleExpanded).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Key' })).not.toBeInTheDocument();
  });

  it('when full screen, folds the key behind a button', async () => {
    renderMap({ expanded: true });
    const key = screen.getByRole('button', { name: 'Key' });
    expect(key).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(key);
    expect(key).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('map').closest('.map-shell')).toHaveClass('is-expanded', 'key-open');
  });

  it('shows location errors only when full screen', () => {
    renderMap({ locationError: 'Location access is blocked.' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows location errors on the full-screen map', () => {
    renderMap({ expanded: true, locationError: 'Location access is blocked.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Location access is blocked.');
  });

  it("shows where the user is", () => {
    renderMap({ livePosition: { lat: 53.8, lon: -1.5, accuracy: 20 } });
    expect(screen.getByTestId('you-are-here')).toBeInTheDocument();
  });
});
