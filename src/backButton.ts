import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

// Things the Android Back button should close, the most recently opened last
const handlers: Array<{ current: () => void }> = [];
let listening = false;

/**
 * Listens for the Android Back button. Once an app listens, Android no
 * longer handles Back itself, so with nothing open this does what it would
 * have done: go back in the web view's history, or leave the app.
 */
const listen = () => {
  if (listening || !Capacitor.isNativePlatform()) {
    return;
  }
  listening = true;
  void App.addListener('backButton', ({ canGoBack }) => {
    const top = handlers[handlers.length - 1];
    if (top) {
      top.current();
    } else if (canGoBack) {
      window.history.back();
    } else {
      void App.exitApp();
    }
  });
};

/**
 * While `active`, the Android Back button calls `onBack` (for example, to
 * close whatever is open) instead of leaving the app. When several things
 * are open, Back closes the one opened last. Does nothing in a browser.
 */
export const useBackButton = (onBack: () => void, active = true) => {
  const handler = useRef(onBack);
  useEffect(() => {
    handler.current = onBack;
  });

  useEffect(() => {
    if (!active) {
      return;
    }
    listen();
    const entry = handler;
    handlers.push(entry);
    return () => {
      const index = handlers.lastIndexOf(entry);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    };
  }, [active]);
};
