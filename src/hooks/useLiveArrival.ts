import { useEffect, useRef, useState } from 'react';
import type { PubLocation } from '../types';
import type { Crawl } from '../crawl';
import { useArrival, useLiveLocation } from '../liveLocation';

// Whether live location was left on, remembered between visits
const settingKey = 'spoons-collector-live-location';
const readSetting = () => {
  try {
    return window.localStorage.getItem(settingKey) === 'on';
  } catch {
    return false;
  }
};

type LiveArrivalOptions = {
  locations: PubLocation[];
  pubsById: Map<number, PubLocation>;
  selectedId: number;
  crawl: Crawl | null;
  isCrawlMode: boolean;
  isCheckedInToday: (pubId: number) => boolean;
  selectAnyPub: (pubId: number) => void;
};

/**
 * Live location: follows the user while it's on, and notices when they're
 * at a Wetherspoon, offering to check in with a banner.
 */
export const useLiveArrival = ({
  locations,
  pubsById,
  selectedId,
  crawl,
  isCrawlMode,
  isCheckedInToday,
  selectAnyPub,
}: LiveArrivalOptions) => {
  const [isOn, setIsOn] = useState(readSetting);
  // Pubs whose "You're at" banner the user closed this session
  const [dismissed, setDismissed] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    try {
      window.localStorage.setItem(settingKey, isOn ? 'on' : 'off');
    } catch {
      // Not remembered; it just starts off next time
    }
  }, [isOn]);

  const live = useLiveLocation(isOn);
  const arrivedPubId = useArrival(live.position, locations);
  const arrivedPub = arrivedPubId === null ? undefined : pubsById.get(arrivedPubId);
  const crawlIndex =
    crawl && arrivedPubId !== null ? crawl.stops.findIndex((stop) => stop.pubId === arrivedPubId) : -1;

  // Whether the user has picked a pub themselves. Until they have (or when
  // they reach a stop on their crawl), arriving at a pub selects it, so the
  // map follows them; otherwise the banner just offers it.
  const userHasChosenPub = useRef(false);
  const autoSelectedPubId = useRef<number | null>(null);
  // The pub selected when the app opened, which the user didn't choose
  const initialPubId = useRef(selectedId);
  useEffect(() => {
    if (selectedId !== initialPubId.current && selectedId !== autoSelectedPubId.current) {
      userHasChosenPub.current = true;
    }
  }, [selectedId]);

  useEffect(() => {
    if (arrivedPubId === null) return;
    const isCrawlStop = isCrawlMode && crawlIndex !== -1;
    if (!userHasChosenPub.current || isCrawlStop) {
      autoSelectedPubId.current = arrivedPubId;
      selectAnyPub(arrivedPubId);
    }
    // Only when the user arrives somewhere new
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrivedPubId]);

  // The banner: not for a pub dismissed, or already checked in at today
  const bannerPub =
    arrivedPub && !dismissed.has(arrivedPub.id) && !isCheckedInToday(arrivedPub.id)
      ? arrivedPub
      : undefined;

  return {
    isOn,
    toggle: () => setIsOn((on) => !on),
    position: live.position,
    error: live.error,
    bannerPub,
    // When the pub is a stop on the crawl: which one, of how many
    crawlStop:
      crawl && crawlIndex !== -1 ? { number: crawlIndex + 1, of: crawl.stops.length } : undefined,
    dismiss: (pubId: number) => setDismissed((current) => new Set(current).add(pubId)),
  };
};
