import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { findCrawlCode } from '../crawlShare';

/**
 * A crawl code arriving from outside the app: a shared link opening the
 * Android app (spoonscollector://crawl/…), or ?crawl=… on the web page.
 * The app asks before joining it.
 */
export const useIncomingCrawl = () => {
  const [code, setCode] = useState<string | null>(() =>
    findCrawlCode(new URLSearchParams(window.location.search).get('crawl') ?? ''),
  );

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = App.addListener('appUrlOpen', ({ url }) => {
      const found = findCrawlCode(decodeURIComponent(url));
      if (found) setCode(found);
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, []);

  const clear = () => {
    setCode(null);
    // Don't offer the same crawl again on reload
    const url = new URL(window.location.href);
    if (url.searchParams.has('crawl')) {
      url.searchParams.delete('crawl');
      window.history.replaceState(null, '', url);
    }
  };

  return { code, clear };
};
