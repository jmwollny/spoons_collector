import type { PubLocation } from './types';

/**
 * Where pub photos come from. Normal builds use our own copies in
 * public/images (fast, and offline in the app). A shareable build
 * (`npm run build:shareable`) loads them from Wetherspoon's own site
 * instead, so the photos aren't redistributed inside it.
 */
export const PHOTOS_ONLINE = import.meta.env.VITE_PUB_PHOTOS === 'online';

/** The pub's photo address, or null if it has none */
export const pubPhotoUrl = (pub: Pick<PubLocation, 'id' | 'imgType' | 'imgUrl'>, online = PHOTOS_ONLINE) => {
  if (!pub.imgType) return null;
  return online ? pub.imgUrl : `/images/${pub.id}.webp`;
};
