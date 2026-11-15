import { describe, expect, it } from 'vitest';
import type L from 'leaflet';
import { clusterIconSize, createClusterIcon, fitPadding, getCrawlIcon, getMarkerIcon } from './mapIcons';
import { setMediaQueryMatches } from '../../test/browser';

describe('getMarkerIcon', () => {
  it('styles the marker by rarity, visited and selected', () => {
    const icon = getMarkerIcon('Epic', true, true);
    expect(icon.options.html).toBe('<div class="spoon-marker rarity-epic visited active"></div>');
    expect(icon.options.iconSize).toEqual([18, 18]);
    expect(getMarkerIcon('Common', false, false).options.html).toBe(
      '<div class="spoon-marker rarity-common  "></div>',
    );
  });

  it('shares one icon per combination', () => {
    expect(getMarkerIcon('Rare', false, true)).toBe(getMarkerIcon('Rare', false, true));
    expect(getMarkerIcon('Rare', false, true)).not.toBe(getMarkerIcon('Rare', true, true));
  });
});

describe('cluster icons', () => {
  it('grow with the number of pubs', () => {
    expect(clusterIconSize(9)).toBe(30);
    expect(clusterIconSize(10)).toBe(36);
    expect(clusterIconSize(49)).toBe(36);
    expect(clusterIconSize(50)).toBe(44);
  });

  it('show the count', () => {
    const icon = createClusterIcon({ getChildCount: () => 125 } as L.MarkerCluster);
    expect(icon.options.html).toBe('<div class="spoon-cluster" style="width:44px;height:44px">125</div>');
    expect(icon.options.iconSize).toEqual([44, 44]);
  });
});

describe('getCrawlIcon', () => {
  it('labels crawl markers and shares them', () => {
    expect(getCrawlIcon('3', 'stop').options.html).toBe('<div class="crawl-marker is-stop">3</div>');
    expect(getCrawlIcon('✓', 'done')).toBe(getCrawlIcon('✓', 'done'));
  });
});

describe('fitPadding', () => {
  it('keeps clear of the card on wide screens, and the sheet on phones', () => {
    setMediaQueryMatches(() => false);
    expect(fitPadding()).toEqual({ paddingTopLeft: [50, 50], paddingBottomRight: [200, 50] });
    setMediaQueryMatches((query) => query === '(max-width: 600px)');
    expect(fitPadding()).toEqual({ paddingTopLeft: [40, 40], paddingBottomRight: [40, 100] });
  });
});
