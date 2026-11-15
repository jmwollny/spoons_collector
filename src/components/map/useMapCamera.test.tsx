import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MapCamera } from './MapCamera';
import { fakeMap, resetFakeMap } from '../../test/leafletStub';
import { setMediaQueryMatches } from '../../test/browser';

vi.mock('react-leaflet', () => import('../../test/leafletStub'));

type CameraProps = React.ComponentProps<typeof MapCamera>;
const camera = (props: Partial<CameraProps> = {}) => (
  <MapCamera selected={undefined} userPosition={null} expanded={false} {...props} />
);

beforeEach(() => {
  resetFakeMap();
  setMediaQueryMatches(() => false);
});

describe('MapCamera', () => {
  it("doesn't move the map for the pub selected when the app opens", () => {
    render(camera({ selected: { lat: 53.8, lon: -1.5 } }));
    expect(fakeMap.setView).not.toHaveBeenCalled();
    expect(fakeMap.panTo).not.toHaveBeenCalled();
  });

  it('zooms in to a newly selected pub', () => {
    const { rerender } = render(camera({ selected: { lat: 53.8, lon: -1.5 } }));
    rerender(camera({ selected: { lat: 54, lon: -1.1 } }));
    expect(fakeMap.setView).toHaveBeenCalledWith([54, -1.1], 12);
  });

  it('keeps the zoom when already zoomed in, just moving', () => {
    fakeMap.zoom = 15;
    const { rerender } = render(camera({ selected: { lat: 53.8, lon: -1.5 } }));
    rerender(camera({ selected: { lat: 54, lon: -1.1 } }));
    expect(fakeMap.panTo).toHaveBeenCalledWith([54, -1.1]);
    expect(fakeMap.setView).not.toHaveBeenCalled();
  });

  it('centres the pub above the phone sheet', () => {
    // A visible sheet 100px tall, next to the map
    const parent = document.createElement('div');
    const sheet = document.createElement('div');
    sheet.className = 'map-pub-sheet';
    Object.defineProperty(sheet, 'offsetHeight', { value: 100 });
    Object.defineProperty(sheet, 'offsetParent', { value: parent });
    parent.append(fakeMap.container, sheet);
    const { rerender } = render(camera({ selected: { lat: 53.8, lon: -1.5 } }));
    rerender(camera({ selected: { lat: 54, lon: -1.1 } }));
    // (100 + 22) / 2 = 61 "pixels" down, which the fake map treats as degrees
    expect(fakeMap.setView).toHaveBeenCalledWith([115, -1.1], 12);
  });

  it("doesn't move again for the same pub", () => {
    const { rerender } = render(camera({ selected: { lat: 53.8, lon: -1.5 } }));
    rerender(camera({ selected: { lat: 54, lon: -1.1 } }));
    rerender(camera({ selected: { lat: 54, lon: -1.1 } }));
    expect(fakeMap.setView).toHaveBeenCalledOnce();
  });

  it('after Near me, fits the user and the pub on screen', () => {
    const { rerender } = render(camera({ selected: { lat: 53.8, lon: -1.5 } }));
    rerender(camera({ selected: { lat: 53.8, lon: -1.5 }, userPosition: { lat: 53.9, lon: -1.6 } }));
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(
      [
        [53.9, -1.6],
        [53.8, -1.5],
      ],
      { paddingTopLeft: [50, 50], paddingBottomRight: [200, 50], maxZoom: 15 },
    );
  });

  it('turns wheel zoom on only while the map fills the screen', () => {
    const { rerender } = render(camera());
    expect(fakeMap.scrollWheelZoom.disable).toHaveBeenCalled();
    rerender(camera({ expanded: true }));
    expect(fakeMap.scrollWheelZoom.enable).toHaveBeenCalled();
    expect(fakeMap.invalidateSize).toHaveBeenCalled();
  });
});
