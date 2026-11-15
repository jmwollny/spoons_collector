import { useEffect, useState } from 'react';
import { loadPhotoUrl } from '../photos';

/**
 * A URL for a visit's photo, once loaded; null without one. Releases the
 * URL again when no longer needed.
 */
export const usePhotoUrl = (visitId: string | null, hasPhoto: boolean | undefined) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!visitId || !hasPhoto) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let loaded: string | null = null;
    void loadPhotoUrl(visitId).then((photoUrl) => {
      loaded = photoUrl;
      if (cancelled) {
        if (photoUrl?.startsWith('blob:')) URL.revokeObjectURL(photoUrl);
      } else {
        setUrl(photoUrl);
      }
    });
    return () => {
      cancelled = true;
      if (loaded?.startsWith('blob:')) URL.revokeObjectURL(loaded);
    };
  }, [visitId, hasPhoto]);

  return url;
};
