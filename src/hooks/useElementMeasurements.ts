import { useLayoutEffect, useState, type RefObject } from 'react';

/** The width of an element's content, updating as it changes */
export const useContentWidth = (ref: RefObject<HTMLElement | null>) => {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, [ref]);
  return width;
};

/**
 * How far down the page an element starts, kept up to date as what's above
 * it changes height (watching the page's size)
 */
export const usePageOffset = (ref: RefObject<HTMLElement | null>) => {
  const [offset, setOffset] = useState(0);
  useLayoutEffect(() => {
    const update = () => {
      if (ref.current) {
        setOffset(Math.round(ref.current.getBoundingClientRect().top + window.scrollY));
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [ref]);
  return offset;
};
