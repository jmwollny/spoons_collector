/// <reference types="leaflet.markercluster" />
import L from 'leaflet';

// Zoom used when a pub is selected: about a town's width
export const PUB_ZOOM = 12;
// From this zoom in, every pub is shown individually rather than grouped
export const UNGROUPED_FROM_ZOOM = 10;

// Marker icons are shared: one per combination of rarity, visited and
// selected, rather than a new icon for each of 800 markers on every render
const markerIcons = new Map<string, L.DivIcon>();

export const getMarkerIcon = (rarity: string, isVisited: boolean, isSelected: boolean) => {
  const key = `${rarity}|${isVisited}|${isSelected}`;
  let icon = markerIcons.get(key);
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
    markerIcons.set(key, icon);
  }
  return icon;
};

/** A group of pubs shown as one bubble with a count, bigger for more pubs */
export const clusterIconSize = (count: number) => (count < 10 ? 30 : count < 50 ? 36 : 44);

export const createClusterIcon = (cluster: L.MarkerCluster) => {
  const count = cluster.getChildCount();
  const size = clusterIconSize(count);
  return L.divIcon({
    className: 'spoon-cluster-icon',
    html: `<div class="spoon-cluster" style="width:${size}px;height:${size}px">${count}</div>`,
    iconSize: [size, size],
  });
};

// Numbered crawl markers, shared like the pub markers
const crawlIcons = new Map<string, L.DivIcon>();

export const getCrawlIcon = (label: string, kind: 'stop' | 'done' | 'start') => {
  const key = `${kind}|${label}`;
  let icon = crawlIcons.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: 'crawl-marker-icon',
      html: `<div class="crawl-marker is-${kind}">${label}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    crawlIcons.set(key, icon);
  }
  return icon;
};

/**
 * Padding for zooming the map to fit a set of points, keeping clear of what
 * sits on top of the map: the pub card in the top-right corner on wide
 * screens, the pub sheet along the bottom on phones.
 */
export const fitPadding = (): L.FitBoundsOptions =>
  window.matchMedia('(max-width: 600px)').matches
    ? { paddingTopLeft: [40, 40], paddingBottomRight: [40, 100] }
    : { paddingTopLeft: [50, 50], paddingBottomRight: [200, 50] };
