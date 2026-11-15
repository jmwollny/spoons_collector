import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PubMarkers } from './PubMarkers';
import { CrawlRouteLayer, type CrawlRoute } from './CrawlRouteLayer';
import { UserLocationLayer } from './UserLocationLayer';
import { fakeMap, resetFakeMap } from '../../test/leafletStub';
import { samplePubs } from '../../test/fixtures';

vi.mock('react-leaflet', () => import('../../test/leafletStub'));
vi.mock('react-leaflet-cluster', () =>
  import('../../test/leafletStub').then((module) => ({ default: module.MarkerClusterGroup })),
);

beforeEach(() => {
  resetFakeMap();
});

describe('PubMarkers', () => {
  it('places a marker for each pub, named and styled', () => {
    render(<PubMarkers pubs={samplePubs} visitedIds={new Set([2])} selectedId={3} onSelect={vi.fn()} />);
    const markers = screen.getAllByTestId('marker');
    expect(markers.map((marker) => marker.textContent)).toEqual([
      'The Cuthbert Brodrick, Leeds',
      'The Hedley Verity, Leeds',
      'The Punch Bowl, York',
      'The Counting House, Glasgow',
    ]);
    expect(markers[1].dataset.icon).toContain('visited');
    expect(markers[2].dataset.icon).toContain('active');
    // The selected pub's marker sits on top
    expect(markers[2].dataset.z).toBe('1000');
    expect(markers[0].dataset.z).toBe('0');
    expect(screen.getByTestId('cluster-group')).toContainElement(markers[0]);
  });

  it('selects a pub when its marker is clicked', async () => {
    const onSelect = vi.fn();
    render(<PubMarkers pubs={samplePubs} visitedIds={new Set()} selectedId={1} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'The Punch Bowl, York' }));
    expect(onSelect).toHaveBeenCalledWith(3);
  });
});

const route: CrawlRoute = {
  start: { lat: 53.8, lon: -1.55, label: 'Leeds' },
  stops: [
    { pubId: 1, number: 1, lat: 53.801, lon: -1.547, name: 'The Cuthbert Brodrick', done: true },
    { pubId: 2, number: 2, lat: 53.802, lon: -1.546, name: 'The Hedley Verity', done: false },
  ],
};

describe('CrawlRouteLayer', () => {
  it('draws a line through the start and stops, with numbered markers', () => {
    render(<CrawlRouteLayer route={route} fitKey={0} onSelect={vi.fn()} />);
    expect(JSON.parse(screen.getByTestId('line').dataset.positions!)).toEqual([
      [53.8, -1.55],
      [53.801, -1.547],
      [53.802, -1.546],
    ]);
    expect(screen.getByRole('button', { name: 'Start: Leeds' }).dataset.icon).toContain('🏁');
    expect(screen.getByRole('button', { name: '1. The Cuthbert Brodrick' }).dataset.icon).toContain('is-done');
    expect(screen.getByRole('button', { name: '2. The Hedley Verity' }).dataset.icon).toContain('>2<');
  });

  it('follows the streets once the route is in, dashing only the leg from the start', () => {
    const streetPath: Array<[number, number]> = [
      [53.801, -1.547],
      [53.8015, -1.5465],
      [53.802, -1.546],
    ];
    render(<CrawlRouteLayer route={{ ...route, streetPath }} fitKey={0} onSelect={vi.fn()} />);
    const lines = screen.getAllByTestId('line').map((line) => JSON.parse(line.dataset.positions!));
    expect(lines).toEqual([
      [
        [53.8, -1.55],
        [53.801, -1.547],
      ],
      streetPath,
    ]);
  });

  it('numbers stops by their place on the crawl, even with some hidden', () => {
    render(<CrawlRouteLayer route={{ start: null, stops: [{ ...route.stops[1], number: 3 }] }} fitKey={0} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: '3. The Hedley Verity' }).dataset.icon).toContain('>3<');
  });

  it('starting at a pub, has no separate start marker', () => {
    render(<CrawlRouteLayer route={{ ...route, start: null }} fitKey={0} onSelect={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^Start/ })).not.toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('line').dataset.positions!)).toHaveLength(2);
  });

  it('selects a stop when its marker is clicked', async () => {
    const onSelect = vi.fn();
    render(<CrawlRouteLayer route={route} fitKey={0} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: '2. The Hedley Verity' }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('zooms to the whole route when asked, not before', () => {
    const { rerender } = render(<CrawlRouteLayer route={route} fitKey={0} onSelect={vi.fn()} />);
    expect(fakeMap.fitBounds).not.toHaveBeenCalled();
    rerender(<CrawlRouteLayer route={route} fitKey={1} onSelect={vi.fn()} />);
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(
      [
        [53.8, -1.55],
        [53.801, -1.547],
        [53.802, -1.546],
      ],
      expect.objectContaining({ maxZoom: 15 }),
    );
    // Ticking off a stop doesn't zoom again
    rerender(
      <CrawlRouteLayer
        route={{ ...route, stops: route.stops.map((stop) => ({ ...stop, done: true })) }}
        fitKey={1}
        onSelect={vi.fn()}
      />,
    );
    expect(fakeMap.fitBounds).toHaveBeenCalledOnce();
  });
});

describe('UserLocationLayer', () => {
  it('shows nothing until the user has been found', () => {
    render(<UserLocationLayer />);
    expect(screen.queryByTestId('you-are-here')).not.toBeInTheDocument();
  });

  it('shows where Near me found the user', () => {
    render(<UserLocationLayer userPosition={{ lat: 53.8, lon: -1.5 }} />);
    expect(screen.getByTestId('you-are-here')).toHaveAttribute('data-center', '53.8,-1.5');
    expect(screen.getByText('You are here')).toBeInTheDocument();
    expect(screen.queryByTestId('accuracy-circle')).not.toBeInTheDocument();
  });

  it('prefers the live position, with its accuracy', () => {
    render(
      <UserLocationLayer
        userPosition={{ lat: 53.8, lon: -1.5 }}
        livePosition={{ lat: 54, lon: -1.6, accuracy: 25 }}
      />,
    );
    expect(screen.getByTestId('you-are-here')).toHaveAttribute('data-center', '54,-1.6');
    expect(screen.getByTestId('accuracy-circle')).toHaveAttribute('data-radius', '25');
  });
});
