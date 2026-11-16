import { useState } from 'react';
import { useMediaQuery } from './useMediaQuery';

/** The three views phones switch between with the tab bar */
export type AppView = 'map' | 'cards' | 'stats';

export const APP_VIEWS: AppView[] = ['map', 'cards', 'stats'];
const VIEW_KEY = 'spoons-collector-view';

// Phones show one view at a time; wider screens show them all together
export const PHONE_QUERY = '(max-width: 600px)';

const readView = (): AppView => {
  try {
    const saved = window.localStorage.getItem(VIEW_KEY);
    return APP_VIEWS.includes(saved as AppView) ? (saved as AppView) : 'map';
  } catch {
    return 'map';
  }
};

/**
 * Which view a phone shows: the map, the cards or the stats. The user's
 * choice is remembered for next time. On wider screens every view shows at
 * once, so isTabbed is false and the view doesn't matter.
 */
export const useAppView = () => {
  const isTabbed = useMediaQuery(PHONE_QUERY);
  const [view, setView] = useState<AppView>(readView);
  const choose = (next: AppView) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Not remembered, e.g. in a private window; the view still changes
    }
  };
  return { isTabbed, view, choose };
};
