import { useEffect } from 'react';

// How many overlays are holding the lock, so the page only scrolls again
// once the last one closes
let locks = 0;

/** While `active`, the page behind an overlay can't scroll */
export const useBodyScrollLock = (active = true) => {
  useEffect(() => {
    if (!active) return;
    locks += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      locks -= 1;
      if (locks === 0) document.body.style.overflow = '';
    };
  }, [active]);
};
