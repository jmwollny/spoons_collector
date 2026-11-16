import { useEffect, useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import type { PubLocation } from './types';
import { cachedPubPhotoUrl, keepPubPhoto, pubPhotosVersion, subscribeToPubPhotos } from './pubPhotoCache';

/**
 * Where pub photos come from. Normal builds use our own copies in
 * public/images (fast, and offline in the app). A shareable build
 * (`npm run build:shareable`) loads them from Wetherspoon's own site
 * instead, so the photos aren't redistributed inside it; in the Android
 * app, each is then kept on the phone once shown (see pubPhotoCache.ts).
 */
export const PHOTOS_ONLINE = import.meta.env.VITE_PUB_PHOTOS === 'online';

type PhotoPub = Pick<PubLocation, 'id' | 'imgType' | 'imgUrl'>;

/** The pub's photo address, or null if it has none */
export const pubPhotoUrl = (pub: PhotoPub, online = PHOTOS_ONLINE) => {
  if (!pub.imgType) return null;
  return online ? pub.imgUrl : `/images/${pub.id}.webp`;
};

const noop = () => () => {};
const zero = () => 0;

/**
 * The pub's photo address, as pubPhotoUrl, but in a shareable build of the
 * Android app, the copy kept on the phone once there is one.
 */
export const usePubPhotoUrl = (pub: PhotoPub, online = PHOTOS_ONLINE) => {
  const keeps = online && Capacitor.isNativePlatform();
  // Shows the kept copies once they're known
  useSyncExternalStore(keeps ? subscribeToPubPhotos : noop, keeps ? pubPhotosVersion : zero);
  const url = pubPhotoUrl(pub, online);
  const kept = keeps && url ? cachedPubPhotoUrl(pub) : null;

  useEffect(() => {
    if (keeps && url && !kept) void keepPubPhoto(pub);
    // pub's photo is fixed by its id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keeps, url, kept, pub.id]);

  return kept ?? url;
};
