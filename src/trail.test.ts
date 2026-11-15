// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { crawlTrail, usePubTrail } from './trail';
import { makePub } from './test/pubs';
import type { PubLocation } from './types';

// Pubs along a line, each further from pub 1: 1, 2, 3, 4, 5
const line = [1, 2, 3, 4, 5].map((id) => makePub(id, 53.8 + (id - 1) * 0.001, -1.55));
const byId = new Map(line.map((pub) => [pub.id, pub]));

/** usePubTrail with the selection held in the test, as App holds it */
const renderTrail = (candidates: PubLocation[] = line, startId = 1) => {
  let selected = startId;
  const select = vi.fn((id: number) => {
    selected = id;
  });
  const hook = renderHook(() => usePubTrail(selected, candidates, byId, select));
  const step = (direction: 'next' | 'previous') => {
    act(() => {
      if (direction === 'next') hook.result.current.goNext();
      else hook.result.current.goPrevious();
    });
    hook.rerender();
  };
  return { hook, step, selectedId: () => selected, setSelected: (id: number) => (selected = id) };
};

describe('usePubTrail', () => {
  it('steps outward to the nearest pub not yet on the trail', () => {
    // From 3, the nearest are 2 and 4 (equal); then it must not go back to 3
    const { hook, step, selectedId } = renderTrail(line, 1);
    expect(hook.result.current.previous).toBeNull();
    expect(hook.result.current.next?.pub.id).toBe(2);
    step('next');
    step('next');
    expect(selectedId()).toBe(3);
    step('next');
    expect(selectedId()).toBe(4);
  });

  it('steps back along the trail, then retraces it', () => {
    const { hook, step, selectedId } = renderTrail(line, 1);
    step('next');
    step('next');
    step('previous');
    expect(selectedId()).toBe(2);
    expect(hook.result.current.next?.pub.id).toBe(3);
    step('next');
    expect(selectedId()).toBe(3);
  });

  it('follows the filters: only candidates are stepped to', () => {
    const { hook } = renderTrail([line[0], line[3], line[4]], 1);
    expect(hook.result.current.next?.pub.id).toBe(4);
  });

  it('starts a new trail when the pub is picked another way', () => {
    const { hook, step, setSelected } = renderTrail(line, 1);
    step('next');
    setSelected(5);
    hook.rerender();
    expect(hook.result.current.previous).toBeNull();
    expect(hook.result.current.next?.pub.id).toBe(4);
  });

  it('reports the distance to the next pub', () => {
    const { hook } = renderTrail(line, 1);
    // 0.001° of latitude is about 0.069 miles
    expect(hook.result.current.next?.miles).toBeCloseTo(0.069, 2);
  });
});

describe('crawlTrail', () => {
  const stops = [3, 1, 5];
  const select = vi.fn();

  it('follows the stops in order, numbering them', () => {
    const trail = crawlTrail(stops, new Set(), 1, byId, select);
    expect(trail.mode).toBe('crawl');
    expect(trail.previous?.pub.id).toBe(3);
    expect(trail.previous?.stopNumber).toBe(1);
    expect(trail.next?.pub.id).toBe(5);
    expect(trail.next?.stopNumber).toBe(3);
  });

  it('has no Next at the last stop', () => {
    expect(crawlTrail(stops, new Set(), 5, byId, select).next).toBeNull();
  });

  it('from a pub not on the crawl, goes to the first stop not yet visited', () => {
    const trail = crawlTrail(stops, new Set([3]), 2, byId, select);
    expect(trail.previous).toBeNull();
    expect(trail.next?.pub.id).toBe(1);
    trail.goNext();
    expect(select).toHaveBeenCalledWith(1);
  });
});
