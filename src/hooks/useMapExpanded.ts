import { useState } from 'react';
import { useDismiss } from './useDismiss';
import { useBodyScrollLock } from './useBodyScrollLock';

/**
 * Whether the map fills the screen. Escape or the Android Back button
 * shrinks it (after closing anything open on top of it), and the page
 * behind can't scroll meanwhile.
 */
export const useMapExpanded = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  useDismiss(() => setIsExpanded(false), isExpanded);
  useBodyScrollLock(isExpanded);
  return { isExpanded, toggle: () => setIsExpanded((expanded) => !expanded) };
};
