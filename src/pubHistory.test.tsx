import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { pubHistoryNow, resetPubHistories, usePubHistory } from './pubHistory';
import { CardBack } from './components/card/CardBack';

const shareablePub = { history: '', historyId: 1352 };
const excerpt = '<p>Ryde developed as a seaside resort. S. Fowler &amp; Co. was a draper’s.</p>\n';
const answer = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

describe('usePubHistory', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetPubHistories();
    vi.stubGlobal('fetch', vi.fn(async () => answer({ excerpt: { rendered: excerpt } })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('uses the history in the data in a normal build', () => {
    const { result } = renderHook(() => usePubHistory({ history: 'Once a bank.', historyId: 1352 }, true, false));
    expect(result.current).toEqual({ text: 'Once a bank.', status: 'ready' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("in a shareable build, loads it from Wetherspoon's site as plain text", async () => {
    const { result } = renderHook(() => usePubHistory(shareablePub, true, true));
    expect(result.current.status).toBe('loading');
    await waitFor(() =>
      expect(result.current).toEqual({
        text: 'Ryde developed as a seaside resort. S. Fowler & Co. was a draper’s.',
        status: 'ready',
      }),
    );
    expect(fetch).toHaveBeenCalledWith(
      'https://www.jdwetherspoon.com/wp-json/wp/v2/pub-histories/1352?_fields=excerpt',
    );
  });

  it('keeps it on the device, so it loads only once', async () => {
    const first = renderHook(() => usePubHistory(shareablePub, true, true));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    first.unmount();
    // As if the app had been closed and opened again
    resetPubHistories();
    expect(pubHistoryNow(shareablePub, true).text).toMatch(/^Ryde developed/);
    renderHook(() => usePubHistory(shareablePub, true, true));
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("doesn't load it until it's needed", async () => {
    const { rerender, result } = renderHook(({ needed }) => usePubHistory(shareablePub, needed, true), {
      initialProps: { needed: false },
    });
    await act(async () => {});
    expect(fetch).not.toHaveBeenCalled();
    rerender({ needed: true });
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it("says when it couldn't be loaded, and tries again next time", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    const first = renderHook(() => usePubHistory(shareablePub, true, true));
    await waitFor(() => expect(first.result.current.status).toBe('failed'));
    first.unmount();
    vi.mocked(fetch).mockResolvedValue(answer({ excerpt: { rendered: excerpt } }));
    const again = renderHook(() => usePubHistory(shareablePub, true, true));
    await waitFor(() => expect(again.result.current.status).toBe('ready'));
  });

  it('treats an answer that is not a history as a failure', async () => {
    vi.mocked(fetch).mockResolvedValue(answer({ code: 'rest_post_invalid_id' }, false));
    const { result } = renderHook(() => usePubHistory(shareablePub, true, true));
    await waitFor(() => expect(result.current.status).toBe('failed'));
  });

  it('has nothing to load for a pub without a history on the site', () => {
    const { result } = renderHook(() => usePubHistory({ history: '', historyId: null }, true, true));
    expect(result.current).toEqual({ text: '', status: 'ready' });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('CardBack', () => {
  const props = {
    name: 'S. Fowler & Co.',
    visited: false,
    history: 'Once a draper’s.',
    nearestMiles: 1,
    secondMiles: 2,
    website: 'NONE',
    menu: 'NONE',
    hidden: false,
  };

  it('shows the history', () => {
    render(<CardBack {...props} />);
    expect(screen.getByText('Once a draper’s.')).toBeInTheDocument();
  });
});
