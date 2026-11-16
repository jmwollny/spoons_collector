import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * Telling users of the Android app when there's a newer version on GitHub.
 * An APK installed by hand never updates itself, so without this they'd
 * never know. Releases are tagged with the version, e.g. v1.2 (see
 * RELEASING.md). The browser version is always up to date, so never checks.
 */

const LATEST_RELEASE_URL = 'https://api.github.com/repos/jmwollny/spoons_collector/releases/latest';

// When GitHub was last asked (YYYY-MM-DD): at most once a day
const checkedKey = 'spoons-collector-update-checked';
// The latest release found, so it's shown on days GitHub isn't asked
const latestKey = 'spoons-collector-update-latest';
// The version the user said "Not now" to
const dismissedKey = 'spoons-collector-update-dismissed';

export type Release = { version: string; url: string };

/** Compares versions like 1.2 or v1.10.1: above 0 if a is newer than b */
export const compareVersions = (a: string, b: string) => {
  const parts = (version: string) => version.replace(/^v/i, '').split('.').map((part) => parseInt(part, 10) || 0);
  const [first, second] = [parts(a), parts(b)];
  for (let index = 0; index < Math.max(first.length, second.length); index++) {
    const difference = (first[index] ?? 0) - (second[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
};

/** The latest release on GitHub; null if there isn't one or GitHub can't be reached */
export const fetchLatestRelease = async (): Promise<Release | null> => {
  try {
    const response = await fetch(LATEST_RELEASE_URL, { headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) return null;
    const release = (await response.json()) as { tag_name?: unknown; html_url?: unknown };
    if (typeof release.tag_name !== 'string' || typeof release.html_url !== 'string') return null;
    return { version: release.tag_name.replace(/^v/i, ''), url: release.html_url };
  } catch {
    return null;
  }
};

const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Only means asking GitHub again
  }
};

const readLatest = (): Release | null => {
  try {
    const release = JSON.parse(read(latestKey) ?? 'null') as Release | null;
    return typeof release?.version === 'string' && typeof release.url === 'string' ? release : null;
  } catch {
    return null;
  }
};

/**
 * A newer version of the app than this one, unless the user has said
 * "Not now" to it; and dismissing it.
 */
export const useAppUpdate = (today: string) => {
  const [update, setUpdate] = useState<Release | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    void (async () => {
      const { version: installed } = await App.getInfo();
      let latest = readLatest();
      if (read(checkedKey) !== today) {
        const found = await fetchLatestRelease();
        write(checkedKey, today);
        if (found) {
          latest = found;
          write(latestKey, JSON.stringify(found));
        }
      }
      if (
        !cancelled &&
        latest &&
        compareVersions(latest.version, installed) > 0 &&
        read(dismissedKey) !== latest.version
      ) {
        setUpdate(latest);
      }
    })().catch(() => {
      // No update notice; nothing else is affected
    });
    return () => {
      cancelled = true;
    };
  }, [today]);

  const dismiss = () => {
    if (update) write(dismissedKey, update.version);
    setUpdate(null);
  };

  return { update, dismiss };
};
