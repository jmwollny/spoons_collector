// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { DWELL_MS, useArrival, type LivePosition } from './liveLocation';
import { makePub } from './test/pubs';

// Two pubs about 125 m apart
const pubs = [makePub(1, 53.8018, -1.5478), makePub(2, 53.8019, -1.5459)];
const atPub1: LivePosition = { lat: 53.8018, lon: -1.5478, accuracy: 15 };
// About 40 m from pub 1: still "at" it
const nearPub1: LivePosition = { lat: 53.80215, lon: -1.5478, accuracy: 15 };
const atPub2: LivePosition = { lat: 53.8019, lon: -1.5459, accuracy: 15 };
// About 330 m away from both
const awayFromBoth: LivePosition = { lat: 53.8048, lon: -1.5478, accuracy: 15 };

const renderArrival = (initial: LivePosition | null) =>
  renderHook(({ position }) => useArrival(position, pubs), {
    initialProps: { position: initial },
  });

describe('useArrival', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('arrives only after staying for the dwell time', () => {
    const hook = renderArrival(atPub1);
    act(() => vi.advanceTimersByTime(DWELL_MS - 1000));
    expect(hook.result.current).toBeNull();
    act(() => vi.advanceTimersByTime(1000));
    expect(hook.result.current).toBe(1);
  });

  it("doesn't count walking past", () => {
    const hook = renderArrival(atPub1);
    act(() => vi.advanceTimersByTime(10_000));
    hook.rerender({ position: awayFromBoth });
    act(() => vi.advanceTimersByTime(DWELL_MS));
    expect(hook.result.current).toBeNull();
  });

  it('ignores readings too inaccurate to trust', () => {
    const hook = renderArrival({ ...atPub1, accuracy: 300 });
    act(() => vi.advanceTimersByTime(DWELL_MS * 2));
    expect(hook.result.current).toBeNull();
  });

  it('stays at the pub through small wobbles, and leaves when the user does', () => {
    const hook = renderArrival(atPub1);
    act(() => vi.advanceTimersByTime(DWELL_MS));
    hook.rerender({ position: nearPub1 });
    expect(hook.result.current).toBe(1);
    hook.rerender({ position: awayFromBoth });
    expect(hook.result.current).toBeNull();
  });

  it('moves on to the next pub after staying there', () => {
    const hook = renderArrival(atPub1);
    act(() => vi.advanceTimersByTime(DWELL_MS));
    hook.rerender({ position: atPub2 });
    // Over 120 m from pub 1, so they've left it
    expect(hook.result.current).toBeNull();
    act(() => vi.advanceTimersByTime(DWELL_MS));
    expect(hook.result.current).toBe(2);
  });

  it('clears when live location is turned off', () => {
    const hook = renderArrival(atPub1);
    act(() => vi.advanceTimersByTime(DWELL_MS));
    hook.rerender({ position: null });
    expect(hook.result.current).toBeNull();
  });
});
