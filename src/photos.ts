import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { blobToBase64 } from './files';

/**
 * Photos of visits, stored on the device under the visit's id. Too big for
 * local storage, so:
 * - in the Android app, as files in the app's own data folder, which
 *   survives the web view's storage being cleared;
 * - in a browser, in IndexedDB.
 */

// Photos are shrunk to fit in this many pixels each way
const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.8;

const filePath = (visitId: string) => `photos/${visitId}.jpg`;

// ---- Browser: IndexedDB ----

const DB_NAME = 'spoons-collector-photos';
const STORE = 'photos';

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withStore = async <T,>(
  mode: IDBTransactionMode,
  use: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = use(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
};

// ---- The store ----

/** Saves a visit's photo, replacing any it had */
export const savePhoto = async (visitId: string, photo: Blob) => {
  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({
      path: filePath(visitId),
      data: await blobToBase64(photo),
      directory: Directory.Data,
      recursive: true,
    });
  } else {
    await withStore('readwrite', (store) => store.put(photo, visitId));
  }
};

/** A URL to show a visit's photo with, or null if it has none here */
export const loadPhotoUrl = async (visitId: string): Promise<string | null> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const { uri } = await Filesystem.getUri({ path: filePath(visitId), directory: Directory.Data });
      await Filesystem.stat({ path: filePath(visitId), directory: Directory.Data });
      return Capacitor.convertFileSrc(uri);
    }
    const blob = await withStore<Blob | undefined>('readonly', (store) => store.get(visitId));
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    // Not on this device, e.g. a visit restored from another phone's backup
    return null;
  }
};

/** Deletes a visit's photo, if it has one */
export const deletePhoto = async (visitId: string) => {
  try {
    if (Capacitor.isNativePlatform()) {
      await Filesystem.deleteFile({ path: filePath(visitId), directory: Directory.Data });
    } else {
      await withStore('readwrite', (store) => store.delete(visitId));
    }
  } catch {
    // Already gone
  }
};

/** The size a photo is shrunk to: no side longer than MAX_SIDE */
export const fitWithin = (width: number, height: number, maxSide = MAX_SIDE) => {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

/**
 * Shrinks a photo from the camera (often 4,000 pixels or more across, and
 * several MB) to a JPEG of at most MAX_SIDE pixels. If the browser can't,
 * the photo is kept as it is.
 */
export const shrinkPhoto = async (photo: Blob): Promise<Blob> => {
  try {
    const image = await createImageBitmap(photo);
    const { width, height } = fitWithin(image.width, image.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return photo;
    context.drawImage(image, 0, 0, width, height);
    image.close();
    const shrunk = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    return shrunk ?? photo;
  } catch {
    return photo;
  }
};
