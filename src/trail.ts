import { useMemo, useState } from 'react';
import type { PubLocation } from './types';
import { distanceMiles } from './utils';

type Trail = { ids: number[]; index: number };

export type TrailStep = {
  pub: PubLocation;
  miles: number;
  // On a crawl: the stop's number, counting from 1
  stopNumber?: number;
};

/** Previous and Next, for the arrows, swipes and arrow keys */
export type PubTrail = {
  // 'nearby' steps to the nearest pubs; 'crawl' follows the crawl's stops
  mode: 'nearby' | 'crawl';
  previous: TrailStep | null;
  next: TrailStep | null;
  goPrevious: () => void;
  goNext: () => void;
};

/**
 * Previous and Next for stepping from pub to nearby pub.
 *
 * Next goes to the nearest pub (among `candidates`, i.e. the current
 * search and filters) not already on the trail, so it works outward from
 * where the user started rather than bouncing between two pubs that are
 * each other's nearest. Previous steps back along the trail, and Next then
 * retraces it, like a browser's Back and Forward.
 *
 * Picking a pub any other way (a marker, the list, Near me) starts a new
 * trail from that pub.
 */
export const usePubTrail = (
  selectedId: number,
  candidates: PubLocation[],
  pubsById: Map<number, PubLocation>,
  select: (id: number) => void,
): PubTrail => {
  const [trail, setTrail] = useState<Trail>({ ids: [selectedId], index: 0 });

  // The trail only counts while it's at the selected pub; otherwise the
  // user has moved elsewhere and a new trail starts there
  const current: Trail =
    trail.ids[trail.index] === selectedId ? trail : { ids: [selectedId], index: 0 };

  const selected = pubsById.get(selectedId);

  const next = useMemo((): TrailStep | null => {
    if (!selected) return null;
    const forward = current.ids[current.index + 1];
    const forwardPub = forward === undefined ? undefined : pubsById.get(forward);
    if (forwardPub) {
      return {
        pub: forwardPub,
        miles: distanceMiles(selected.lat, selected.lon, forwardPub.lat, forwardPub.lon),
      };
    }
    const onTrail = new Set(current.ids);
    let nearest: TrailStep | null = null;
    for (const pub of candidates) {
      if (onTrail.has(pub.id)) continue;
      const miles = distanceMiles(selected.lat, selected.lon, pub.lat, pub.lon);
      if (!nearest || miles < nearest.miles) {
        nearest = { pub, miles };
      }
    }
    return nearest;
    // `current` is rebuilt each render; its contents are what matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, candidates, pubsById, current.ids.join(','), current.index]);

  const previous = useMemo((): TrailStep | null => {
    const back = current.ids[current.index - 1];
    const pub = back === undefined ? undefined : pubsById.get(back);
    if (!pub || !selected) return null;
    return { pub, miles: distanceMiles(selected.lat, selected.lon, pub.lat, pub.lon) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, pubsById, current.ids.join(','), current.index]);

  const goNext = () => {
    if (!next) return;
    const ids =
      current.ids[current.index + 1] === next.pub.id
        ? current.ids
        : [...current.ids.slice(0, current.index + 1), next.pub.id];
    setTrail({ ids, index: current.index + 1 });
    select(next.pub.id);
  };

  const goPrevious = () => {
    if (!previous) return;
    setTrail({ ids: current.ids, index: current.index - 1 });
    select(previous.pub.id);
  };

  return { mode: 'nearby', next, previous, goNext, goPrevious };
};

/**
 * Previous and Next along a crawl's stops, in order. From a pub that isn't
 * on the crawl, Next goes to the first stop not yet visited.
 */
export const crawlTrail = (
  stopIds: number[],
  // Stops already visited on the crawl
  doneIds: Set<number>,
  selectedId: number,
  pubsById: Map<number, PubLocation>,
  select: (id: number) => void,
): PubTrail => {
  const selected = pubsById.get(selectedId);
  const index = stopIds.indexOf(selectedId);
  const step = (stopIndex: number): TrailStep | null => {
    const pub = pubsById.get(stopIds[stopIndex]);
    if (!pub || !selected) return null;
    return {
      pub,
      miles: distanceMiles(selected.lat, selected.lon, pub.lat, pub.lon),
      stopNumber: stopIndex + 1,
    };
  };

  let nextIndex: number;
  if (index === -1) {
    const firstToDo = stopIds.findIndex((id) => !doneIds.has(id));
    nextIndex = firstToDo === -1 ? 0 : firstToDo;
  } else {
    nextIndex = index + 1;
  }
  const next = nextIndex < stopIds.length ? step(nextIndex) : null;
  const previous = index > 0 ? step(index - 1) : null;

  return {
    mode: 'crawl',
    next,
    previous,
    goNext: () => next && select(next.pub.id),
    goPrevious: () => previous && select(previous.pub.id),
  };
};
