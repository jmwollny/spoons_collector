import { vi } from 'vitest';

/** Makes media queries matching `predicate` match, e.g. a phone-sized screen */
export const setMediaQueryMatches = (predicate: (query: string) => boolean) => {
  window.matchMedia = vi.fn((query: string) => ({
    matches: predicate(query),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

/** A touch gesture from one point to another, for fireEvent.touchStart/End */
export const touch = (x: number, y: number) => ({
  touches: [{ clientX: x, clientY: y }],
  changedTouches: [{ clientX: x, clientY: y }],
});

/**
 * jsdom doesn't lay pages out, so every element measures 0 × 0. This gives
 * elements a size for a test (e.g. so a virtual list knows how many rows
 * fit). Returns a function that puts things back.
 */
export const stubLayout = ({ width, height, rowHeight }: { width: number; height: number; rowHeight: number }) => {
  const props: Array<[string, () => number]> = [
    ['clientWidth', () => width],
    ['clientHeight', () => height],
    ['offsetHeight', () => rowHeight],
  ];
  const originals = props.map(([name]) => [name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)] as const);
  for (const [name, get] of props) {
    Object.defineProperty(HTMLElement.prototype, name, { configurable: true, get });
  }
  return () => {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor);
    }
  };
};
