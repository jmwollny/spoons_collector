import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { blobToBase64 } from './files';
import type { PubLocation } from './types';

/**
 * Pub photos kept on the phone, for a shareable build of the app, which
 * loads them from Wetherspoon's site rather than including them. Each photo
 * is saved the first time it's shown, and used from then on, so the photos
 * the user has seen work without a connection.
 *
 * In the app's cache folder: Android may clear it when short of space, and
 * they're simply downloaded again.
 */

const FOLDER = 'pub-photos';
// Downloads at once, so a screen of cards doesn't fetch them all together
const MAX_DOWNLOADS = 2;

type CachedPub = Pick<PubLocation, 'id' | 'imgType' | 'imgUrl'>;

const fileName = (pub: CachedPub) => `${pub.id}.${pub.imgType === 'png' ? 'png' : 'jpg'}`;

// The photos saved, by file name, once the folder has been read
let saved: Set<string> | null = null;
let folderUri: string | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const downloading = new Set<string>();
const queue: CachedPub[] = [];

/** Reads which photos are saved; once */
const load = () => {
  loading ??= (async () => {
    try {
      folderUri = (await Filesystem.getUri({ path: FOLDER, directory: Directory.Cache })).uri;
      const { files } = await Filesystem.readdir({ path: FOLDER, directory: Directory.Cache });
      saved = new Set(files.map((file) => file.name));
    } catch {
      // No folder yet: nothing saved
      saved = new Set();
    }
    listeners.forEach((listener) => listener());
  })();
  return loading;
};

/** The saved photo's address, or null if it isn't saved (or not known yet) */
export const cachedPubPhotoUrl = (pub: CachedPub): string | null =>
  folderUri && saved?.has(fileName(pub)) ? Capacitor.convertFileSrc(`${folderUri}/${fileName(pub)}`) : null;

const download = async (pub: CachedPub) => {
  const name = fileName(pub);
  try {
    const response = await fetch(pub.imgUrl!);
    if (!response.ok) return;
    await Filesystem.writeFile({
      path: `${FOLDER}/${name}`,
      data: await blobToBase64(await response.blob()),
      directory: Directory.Cache,
      recursive: true,
    });
    saved?.add(name);
  } catch {
    // Offline, or out of space: try again next time it's shown
  } finally {
    downloading.delete(name);
    const next = queue.shift();
    if (next) void download(next);
  }
};

/** Saves the pub's photo on the phone, if it isn't already */
export const keepPubPhoto = async (pub: CachedPub) => {
  if (!pub.imgUrl) return;
  await load();
  const name = fileName(pub);
  if (saved!.has(name) || downloading.has(name)) return;
  downloading.add(name);
  if (downloading.size > MAX_DOWNLOADS) {
    queue.push(pub);
  } else {
    void download(pub);
  }
};

/** Calls back once the saved photos are known; returns an unsubscribe */
export const subscribeToPubPhotos = (listener: () => void) => {
  listeners.add(listener);
  void load();
  return () => listeners.delete(listener);
};

/** Changes once the saved photos are known */
export const pubPhotosVersion = () => (saved ? 1 : 0);

/** For tests: forgets what's saved */
export const resetPubPhotoCache = () => {
  saved = null;
  folderUri = null;
  loading = null;
  downloading.clear();
  queue.length = 0;
  listeners.clear();
};
