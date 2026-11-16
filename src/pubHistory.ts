import { useEffect, useSyncExternalStore } from 'react';
import type { PubLocation } from './types';
import { PHOTOS_ONLINE } from './pubPhoto';

/**
 * Pub histories in a shareable build, which leaves Wetherspoon's text out
 * just as it does their photos. A history is loaded from the site's API
 * when it's first needed (a card turned over, a treasure-hunt clue) and
 * kept on the device, so it's only ever loaded once.
 */

const API = 'https://www.jdwetherspoon.com/wp-json/wp/v2/pub-histories/';
const storageKey = 'spoons-collector-pub-histories';

type HistoryPub = Pick<PubLocation, 'history' | 'historyId'>;
export type PubHistory = { text: string; status: 'ready' | 'loading' | 'failed' };

// Histories loaded, by history id; read from storage when first needed
let histories: Record<string, string> | null = null;
const loading = new Set<number>();
const failed = new Set<number>();
const listeners = new Set<() => void>();
// Changes whenever any history loads or fails, for useSyncExternalStore
let version = 0;

const stored = () => {
  if (!histories) {
    try {
      histories = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as Record<string, string>;
    } catch {
      histories = {};
    }
  }
  return histories;
};

const changed = () => {
  version++;
  listeners.forEach((listener) => listener());
};

/** The text of the excerpt's HTML, e.g. "<p>Fowler &amp; Co…</p>" */
const htmlToText = (html: string) =>
  (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Loads a history from the site and keeps it; failures are remembered until tried again */
const load = async (historyId: number) => {
  if (loading.has(historyId)) return;
  loading.add(historyId);
  failed.delete(historyId);
  changed();
  try {
    const response = await fetch(`${API}${historyId}?_fields=excerpt`);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const { excerpt } = (await response.json()) as { excerpt?: { rendered?: unknown } };
    const text = typeof excerpt?.rendered === 'string' ? htmlToText(excerpt.rendered) : '';
    stored()[historyId] = text;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(stored()));
    } catch {
      // Kept for this session only
    }
  } catch {
    failed.add(historyId);
  } finally {
    loading.delete(historyId);
    changed();
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getVersion = () => version;

/** The history as far as it's known, without loading anything */
export const pubHistoryNow = (pub: HistoryPub, online = PHOTOS_ONLINE): PubHistory => {
  if (!online || pub.history || !pub.historyId) return { text: pub.history, status: 'ready' };
  const text = stored()[pub.historyId];
  if (text !== undefined) return { text, status: 'ready' };
  return { text: '', status: failed.has(pub.historyId) ? 'failed' : 'loading' };
};

/**
 * The pub's history: in a normal build, the one in the data; in a
 * shareable one, loaded from Wetherspoon's site (only while `needed`).
 */
export const usePubHistory = (pub: HistoryPub, needed = true, online = PHOTOS_ONLINE): PubHistory => {
  useSyncExternalStore(subscribe, getVersion);
  const history = pubHistoryNow(pub, online);
  const historyId = pub.historyId;
  const toLoad = needed && online && !pub.history && historyId && history.status !== 'ready';

  useEffect(() => {
    // A failed history is tried again each time it's needed
    if (toLoad) void load(historyId);
  }, [toLoad, historyId]);

  return history;
};

/** For tests: forgets every history */
export const resetPubHistories = () => {
  histories = null;
  loading.clear();
  failed.clear();
};
