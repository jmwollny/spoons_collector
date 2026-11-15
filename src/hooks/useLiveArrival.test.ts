import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLiveArrival } from './useLiveArrival';
import { useArrival, useLiveLocation } from '../liveLocation';
import { makeCrawl, samplePubs, samplePubsById } from '../test/fixtures';
import type { Crawl } from '../crawl';

vi.mock('../liveLocation', () => ({ useLiveLocation: vi.fn(), useArrival: vi.fn() }));

const position = { lat: 53.8, lon: -1.5, accuracy: 10 };

type Options = Parameters<typeof useLiveArrival>[0];

const renderLive = (overrides: Partial<Options> = {}) => {
  const selectAnyPub = vi.fn();
  const hook = renderHook((props: Partial<Options>) =>
    useLiveArrival({
      locations: samplePubs,
      pubsById: samplePubsById,
      selectedId: 1,
      crawl: null,
      isCrawlMode: false,
      isCheckedInToday: () => false,
      selectAnyPub,
      ...overrides,
      ...props,
    }),
  );
  return { ...hook, selectAnyPub };
};

const arriveAt = (pubId: number | null) => vi.mocked(useArrival).mockReturnValue(pubId);

beforeEach(() => {
  vi.mocked(useLiveLocation).mockReturnValue({ position, error: null });
  arriveAt(null);
});

describe('useLiveArrival', () => {
  it('is off to start with, and remembers being turned on', () => {
    const { result } = renderLive();
    expect(result.current.isOn).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.isOn).toBe(true);
    expect(window.localStorage.getItem('spoons-collector-live-location')).toBe('on');
    expect(useLiveLocation).toHaveBeenLastCalledWith(true);
  });

  it('starts on if it was left on', () => {
    window.localStorage.setItem('spoons-collector-live-location', 'on');
    const { result } = renderLive();
    expect(result.current.isOn).toBe(true);
  });

  it('passes on the position and any error', () => {
    vi.mocked(useLiveLocation).mockReturnValue({ position, error: 'Location access is blocked.' });
    const { result } = renderLive();
    expect(result.current.position).toBe(position);
    expect(result.current.error).toBe('Location access is blocked.');
  });

  it('offers a banner for the pub the user is at', () => {
    arriveAt(2);
    const { result } = renderLive();
    expect(result.current.bannerPub?.name).toBe('The Hedley Verity');
    expect(result.current.crawlStop).toBeUndefined();
  });

  it('not for a pub already checked in at today, or dismissed', () => {
    arriveAt(2);
    const checkedIn = renderLive({ isCheckedInToday: (id) => id === 2 });
    expect(checkedIn.result.current.bannerPub).toBeUndefined();
    checkedIn.unmount();

    const { result } = renderLive();
    act(() => result.current.dismiss(2));
    expect(result.current.bannerPub).toBeUndefined();
  });

  it("selects the pub when the user hasn't picked one themselves", () => {
    arriveAt(3);
    const { selectAnyPub } = renderLive();
    expect(selectAnyPub).toHaveBeenCalledWith(3);
  });

  it("doesn't take over once the user has picked a pub", () => {
    const { rerender, selectAnyPub } = renderLive();
    rerender({ selectedId: 4 });
    arriveAt(3);
    rerender({ selectedId: 4 });
    expect(selectAnyPub).not.toHaveBeenCalled();
  });

  it('on a crawl, names the stop and always selects it', () => {
    const crawl: Crawl = makeCrawl();
    const { rerender, result, selectAnyPub } = renderLive({ crawl, isCrawlMode: true });
    rerender({ selectedId: 4 });
    arriveAt(2);
    rerender({ selectedId: 4 });
    expect(result.current.crawlStop).toEqual({ number: 2, of: 2 });
    expect(selectAnyPub).toHaveBeenCalledWith(2);
  });
});
