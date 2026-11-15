import { Preferences } from '@capacitor/preferences';
import type { PubLocation, VisitEntry } from './types';
import { mergeVisits } from './backup';

// v1 recorded visits against OSM ids; v2 records them against Wetherspoon ids
export const storageKey = 'spoons-collector-v2';
export const legacyStorageKey = 'spoons-collector-v1';

// The second copy of the visits, kept by @capacitor/preferences. In the
// Android app that's the app's own settings store, which survives the web
// view's storage being cleared; in a browser it's local storage again.
const preferencesKey = 'visits-v2';

type Storage = Pick<globalThis.Storage, 'getItem'>;

/**
 * Reads the saved visits from local storage. The first time this version
 * runs, visits saved by v1 are converted from OSM ids to Wetherspoon ids.
 * The v1 entry is left in place, so nothing is lost if a visit's pub is no
 * longer in the data.
 */
export const loadVisits = (locations: PubLocation[], storage: Storage): VisitEntry[] => {
  const saved = storage.getItem(storageKey);
  if (saved) {
    return JSON.parse(saved) as VisitEntry[];
  }

  const legacy = storage.getItem(legacyStorageKey);
  if (!legacy) {
    return [];
  }

  const idsByOsmId = new globalThis.Map(
    locations.map((location) => [location.osmId, location.id]),
  );
  return (JSON.parse(legacy) as VisitEntry[]).flatMap((visit) => {
    const id = idsByOsmId.get(visit.locationId);
    return id === undefined ? [] : [{ ...visit, locationId: id }];
  });
};

/** The visits in the second copy, or null if there isn't one */
export const loadVisitsCopy = async (): Promise<VisitEntry[] | null> => {
  const { value } = await Preferences.get({ key: preferencesKey });
  return value ? (JSON.parse(value) as VisitEntry[]) : null;
};

export const saveVisitsCopy = (visits: VisitEntry[]) =>
  Preferences.set({ key: preferencesKey, value: JSON.stringify(visits) });

/**
 * Combines the visits from local storage with the second copy. The two
 * are saved together so normally match; if local storage was cleared, the
 * copy brings the visits back. A visit in both is kept as local storage
 * has it.
 */
export const reconcileVisits = (local: VisitEntry[], copy: VisitEntry[] | null) =>
  copy ? mergeVisits(local, copy) : { visits: local, addedCount: 0 };
