import { useEffect, useRef } from 'react';
import type { PubLocation } from '../types';
import { crawlTrail, usePubTrail, type PubTrail } from '../trail';
import type { CrawlSession } from './useCrawlSession';

/**
 * Previous and Next: through the nearest pubs (following the filters), or
 * in crawl mode through the crawl's stops in order. Also steps with the
 * ← and → keys.
 */
export const useActiveTrail = (
  selectedId: number,
  filteredLocations: PubLocation[],
  pubsById: Map<number, PubLocation>,
  crawlSession: CrawlSession,
  selectAnyPub: (pubId: number) => void,
): PubTrail => {
  const nearby = usePubTrail(selectedId, filteredLocations, pubsById, selectAnyPub);
  const { crawl, isCrawlMode, doneStopIds, hiddenIds } = crawlSession;
  const trail =
    isCrawlMode && crawl
      ? crawlTrail(
          crawl.stops.map((stop) => stop.pubId),
          doneStopIds,
          selectedId,
          pubsById,
          selectAnyPub,
          hiddenIds,
        )
      : nearby;

  useArrowKeySteps(trail);
  return trail;
};

/**
 * ← and → step through pubs, unless the user is typing, a dialog is open,
 * or they're panning the map with the keyboard
 */
const useArrowKeySteps = (trail: PubTrail) => {
  const latest = useRef(trail);
  useEffect(() => {
    latest.current = trail;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, select, textarea, [contenteditable="true"]')) return;
      // On the map itself the arrows pan it; on a pub marker they step
      if (target.closest('.leaflet-container') && !target.closest('.leaflet-marker-icon')) return;
      if (document.querySelector('.visit-form-modal-backdrop')) return;
      // Stops the map panning as well when a marker has focus
      event.stopPropagation();
      event.preventDefault();
      if (event.key === 'ArrowRight') latest.current.goNext();
      else latest.current.goPrevious();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);
};
