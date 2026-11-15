import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderHook } from '@testing-library/react';
import { useActiveTrail } from './useActiveTrail';
import type { CrawlSession } from './useCrawlSession';
import { makeCrawl, samplePubs, samplePubsById } from '../test/fixtures';

const session = (overrides: Partial<CrawlSession> = {}) =>
  ({ crawl: null, isCrawlMode: false, doneStopIds: new Set<number>(), ...overrides }) as CrawlSession;

describe('useActiveTrail', () => {
  it('steps through nearby pubs normally', () => {
    const { result } = renderHook(() => useActiveTrail(1, samplePubs, samplePubsById, session(), vi.fn()));
    expect(result.current.mode).toBe('nearby');
    expect(result.current.next?.pub.name).toBe('The Hedley Verity');
  });

  it("in crawl mode, follows the crawl's stops", () => {
    const crawl = session({ crawl: makeCrawl(), isCrawlMode: true });
    const { result } = renderHook(() => useActiveTrail(1, samplePubs, samplePubsById, crawl, vi.fn()));
    expect(result.current.mode).toBe('crawl');
    expect(result.current.next?.stopNumber).toBe(2);
  });

  it('while browsing during a crawl, steps through nearby pubs', () => {
    const crawl = session({ crawl: makeCrawl(), isCrawlMode: false });
    const { result } = renderHook(() => useActiveTrail(1, samplePubs, samplePubsById, crawl, vi.fn()));
    expect(result.current.mode).toBe('nearby');
  });

  describe('arrow keys', () => {
    const renderTrail = () => {
      const select = vi.fn();
      renderHook(() => useActiveTrail(1, samplePubs, samplePubsById, session(), select));
      return select;
    };

    it('→ steps to the next pub', () => {
      const select = renderTrail();
      fireEvent.keyDown(document.body, { key: 'ArrowRight' });
      expect(select).toHaveBeenCalledWith(2);
    });

    it('are ignored while typing, with modifier keys, or in a dialog', () => {
      const select = renderTrail();
      const input = document.createElement('input');
      document.body.append(input);
      fireEvent.keyDown(input, { key: 'ArrowRight' });
      fireEvent.keyDown(document.body, { key: 'ArrowRight', shiftKey: true });
      fireEvent.keyDown(document.body, { key: 'ArrowDown' });
      const dialog = document.createElement('div');
      dialog.className = 'visit-form-modal-backdrop';
      document.body.append(dialog);
      fireEvent.keyDown(document.body, { key: 'ArrowRight' });
      expect(select).not.toHaveBeenCalled();
      input.remove();
      dialog.remove();
    });

    it('pan the map when it has focus, but step from a marker', () => {
      const select = renderTrail();
      const map = document.createElement('div');
      map.className = 'leaflet-container';
      const marker = document.createElement('div');
      marker.className = 'leaflet-marker-icon';
      map.append(marker);
      document.body.append(map);
      fireEvent.keyDown(map, { key: 'ArrowRight' });
      expect(select).not.toHaveBeenCalled();
      fireEvent.keyDown(marker, { key: 'ArrowRight' });
      expect(select).toHaveBeenCalledWith(2);
      map.remove();
    });
  });
});
