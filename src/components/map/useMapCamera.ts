import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { fitPadding, PUB_ZOOM } from './mapIcons';

type MapCameraOptions = {
  // The selected pub's position, if it's on the map
  selected: { lat: number; lon: number } | undefined;
  // Where Near me found the user; a new object each time it's used
  userPosition: { lat: number; lon: number } | null | undefined;
  expanded: boolean;
};

/**
 * Moves the map as the app asks: to the selected pub, to fit the user and
 * the pub Near me picked, and keeps Leaflet in step with the map's size.
 * Must be used inside a MapContainer.
 */
export const useMapCamera = ({ selected, userPosition, expanded }: MapCameraOptions) => {
  const map = useMap();
  const selectedLat = selected?.lat;
  const selectedLon = selected?.lon;

  // Leaflet only notices the window resizing, not the map itself (e.g. the
  // page switching to crawl mode and making it bigger), so watch it
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  // Scroll-wheel zoom is off on the page, where the wheel should scroll the
  // page, but on when the map fills the screen and there's no page to scroll
  useEffect(() => {
    map.invalidateSize();
    if (expanded) {
      map.scrollWheelZoom.enable();
    } else {
      map.scrollWheelZoom.disable();
    }
  }, [expanded, map]);

  // The pub the map was last centred on. It starts as the pub selected when
  // the app opens, so the map opens on the whole country rather than jumping
  // to that pub, and only moves once the user picks one.
  const centredOn = useRef(selectedLat !== undefined ? `${selectedLat},${selectedLon}` : null);

  // Centre on the selected pub when it changes. Keyed on the coordinates
  // rather than the pub list, which is a new array on every search keystroke
  // and would otherwise undo the user's own panning and zooming.
  useEffect(() => {
    if (selectedLat === undefined || selectedLon === undefined) return;
    const key = `${selectedLat},${selectedLon}`;
    if (centredOn.current === key) return;
    centredOn.current = key;

    // Zoomed in already (e.g. stepping between nearby pubs): keep the
    // user's zoom and just move. Otherwise zoom in to about a town.
    const zoom = Math.max(map.getZoom(), PUB_ZOOM);
    // On phones the pub sheet covers the bottom of the map, so centre the
    // pub in the part that's still showing above it
    const sheet = map.getContainer().parentElement?.querySelector<HTMLElement>('.map-pub-sheet');
    const covered = sheet && sheet.offsetParent !== null ? sheet.offsetHeight + 22 : 0;
    const centre = map.unproject(map.project([selectedLat, selectedLon], zoom).add([0, covered / 2]), zoom);
    if (zoom === map.getZoom()) {
      map.panTo(centre);
    } else {
      map.setView(centre, zoom);
    }
  }, [selectedLat, selectedLon, map]);

  // After Near me, zoom to show both the user and the pub it picked.
  // Declared after the effect above so this view wins when both change.
  useEffect(() => {
    if (!userPosition || selectedLat === undefined || selectedLon === undefined) return;
    map.fitBounds(
      [
        [userPosition.lat, userPosition.lon],
        [selectedLat, selectedLon],
      ],
      { ...fitPadding(), maxZoom: 15 },
    );
    // Only when the position changes, not when the user picks another pub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPosition, map]);
};
