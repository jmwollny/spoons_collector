import { useMemo, useState } from 'react';
import type { PubLocation } from './types';
import { distanceMiles } from './utils';

type Trail = { ids: number[]; index: number };

export type TrailStep = { pub: PubLocation; miles: number };

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
) => {
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

  return { next, previous, goNext, goPrevious };
};

export type PubTrail = ReturnType<typeof usePubTrail>;
