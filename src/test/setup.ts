// Runs before every test file
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom leaves out some browser features the app uses; stand-ins follow.

// Media queries: nothing matches unless a test says otherwise (see
// setMediaQueryMatches in ./browser)
if (!window.matchMedia) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.body.style.overflow = '';
});
