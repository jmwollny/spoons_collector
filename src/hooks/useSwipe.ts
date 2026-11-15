import { useRef } from 'react';

type SwipeHandlers = {
  onLeft?: () => void;
  onRight?: () => void;
  onUp?: () => void;
  onDown?: () => void;
};

type SwipeOptions = {
  // How far a finger has to travel sideways, and up or down, for a swipe
  horizontalPx: number;
  verticalPx: number;
  // Up/down swipes starting inside an element matching this are ignored
  // (e.g. a scrolling area), though sideways ones still count
  ignoreVerticalWithin?: string;
};

/**
 * Swipe gestures on an element: spread the returned touch handlers onto
 * it. A swipe is mostly sideways or mostly up/down, whichever is greater.
 *
 * `wasSwipe()` tells a click handler whether the tap it's handling ended a
 * swipe, so a swipe doesn't also count as a tap.
 */
export const useSwipe = (handlers: SwipeHandlers, options: SwipeOptions) => {
  const start = useRef<{ x: number; y: number; ignoreVertical: boolean } | null>(null);
  const swiped = useRef(false);

  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    const target = event.target as HTMLElement;
    swiped.current = false;
    start.current = {
      x: touch.clientX,
      y: touch.clientY,
      ignoreVertical: Boolean(
        options.ignoreVerticalWithin && target.closest?.(options.ignoreVerticalWithin),
      ),
    };
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const from = start.current;
    start.current = null;
    if (!from) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - from.x;
    const dy = touch.clientY - from.y;

    if (Math.abs(dx) > options.horizontalPx && Math.abs(dx) > Math.abs(dy)) {
      swiped.current = true;
      if (dx < 0) handlers.onLeft?.();
      else handlers.onRight?.();
    } else if (!from.ignoreVertical && Math.abs(dy) > options.verticalPx) {
      const handler = dy < 0 ? handlers.onUp : handlers.onDown;
      if (handler) {
        swiped.current = true;
        handler();
      }
    }
  };

  /** Whether the tap being handled ended a swipe (and resets the flag) */
  const wasSwipe = () => {
    const result = swiped.current;
    swiped.current = false;
    return result;
  };

  return { touchHandlers: { onTouchStart, onTouchEnd }, wasSwipe };
};
