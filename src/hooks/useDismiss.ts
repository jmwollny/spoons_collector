import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

// Open things that Escape or the Android Back button close (dialogs, the
// full-size card, the full-screen map), the most recently opened last.
// Only the top one closes, so Escape on a dialog over the map closes the
// dialog, not the map too.
const stack: Array<{ current: () => void }> = [];
let listening = false;

const closeTop = () => {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.current();
  return true;
};

const listen = () => {
  if (listening) return;
  listening = true;

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && closeTop()) {
      event.stopPropagation();
    }
  });

  // Once an app listens for Back, Android no longer handles it itself, so
  // with nothing open this does what it would have done: go back in the
  // web view's history, or leave the app
  if (Capacitor.isNativePlatform()) {
    void App.addListener('backButton', ({ canGoBack }) => {
      if (closeTop()) return;
      if (canGoBack) {
        window.history.back();
      } else {
        void App.exitApp();
      }
    });
  }
};

/**
 * While `active`, Escape and the Android Back button call `onDismiss`
 * (to close whatever is open) instead of leaving the app. When several
 * things are open, they close the one opened last.
 */
export const useDismiss = (onDismiss: () => void, active = true) => {
  const handler = useRef(onDismiss);
  useEffect(() => {
    handler.current = onDismiss;
  });

  useEffect(() => {
    if (!active) return;
    listen();
    const entry = handler;
    stack.push(entry);
    return () => {
      const index = stack.lastIndexOf(entry);
      if (index !== -1) stack.splice(index, 1);
    };
  }, [active]);
};
