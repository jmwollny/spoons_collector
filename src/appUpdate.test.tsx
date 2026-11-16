import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { compareVersions, fetchLatestRelease, useAppUpdate } from './appUpdate';
import { UpdateNotice } from './components/UpdateNotice';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn(() => true) } }));
vi.mock('@capacitor/app', () => ({ App: { getInfo: vi.fn() } }));

const release = { tag_name: 'v1.2', html_url: 'https://github.com/jmwollny/spoons_collector/releases/tag/v1.2' };
const answer = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

describe('compareVersions', () => {
  it('compares each part as a number, with or without a v', () => {
    expect(compareVersions('1.2', '1.1')).toBeGreaterThan(0);
    expect(compareVersions('v1.10', '1.9')).toBeGreaterThan(0);
    expect(compareVersions('1.1', '1.1.0')).toBe(0);
    expect(compareVersions('1.1', '1.1.1')).toBeLessThan(0);
    expect(compareVersions('2.0', '10.0')).toBeLessThan(0);
  });
});

describe('fetchLatestRelease', () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the latest release's version and page", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer(release)));
    expect(await fetchLatestRelease()).toEqual({ version: '1.2', url: release.html_url });
  });

  it('has none when there are no releases, or GitHub is out of reach', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer({ message: 'Not Found' }, false)));
    expect(await fetchLatestRelease()).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await fetchLatestRelease()).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => answer({ tag_name: 3 })));
    expect(await fetchLatestRelease()).toBeNull();
  });
});

describe('useAppUpdate', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(App.getInfo).mockResolvedValue({ version: '1.1' } as Awaited<ReturnType<typeof App.getInfo>>);
    vi.stubGlobal('fetch', vi.fn(async () => answer(release)));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('finds a newer version, and asks GitHub once a day', async () => {
    const { result, unmount } = renderHook(() => useAppUpdate('2026-11-16'));
    await waitFor(() => expect(result.current.update).toEqual({ version: '1.2', url: release.html_url }));
    unmount();
    // Later the same day, from what was found
    const again = renderHook(() => useAppUpdate('2026-11-16'));
    await waitFor(() => expect(again.result.current.update?.version).toBe('1.2'));
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('says nothing when this is the latest version', async () => {
    vi.mocked(App.getInfo).mockResolvedValue({ version: '1.2' } as Awaited<ReturnType<typeof App.getInfo>>);
    const { result } = renderHook(() => useAppUpdate('2026-11-16'));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await act(async () => {});
    expect(result.current.update).toBeNull();
  });

  it('"Not now" stops it for that version, until a newer one', async () => {
    const { result, unmount } = renderHook(() => useAppUpdate('2026-11-16'));
    await waitFor(() => expect(result.current.update).not.toBeNull());
    act(() => result.current.dismiss());
    expect(result.current.update).toBeNull();
    unmount();

    const nextDay = renderHook(() => useAppUpdate('2026-11-17'));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(nextDay.result.current.update).toBeNull();
    nextDay.unmount();

    vi.stubGlobal('fetch', vi.fn(async () => answer({ ...release, tag_name: 'v1.3' })));
    const later = renderHook(() => useAppUpdate('2026-11-18'));
    await waitFor(() => expect(later.result.current.update?.version).toBe('1.3'));
  });

  it("never checks in a browser, which is always up to date", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    renderHook(() => useAppUpdate('2026-11-16'));
    await act(async () => {});
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('UpdateNotice', () => {
  it('links to the new version, and can be put off', async () => {
    const onDismiss = vi.fn();
    render(<UpdateNotice update={{ version: '1.2', url: release.html_url }} onDismiss={onDismiss} />);
    expect(screen.getByRole('status')).toHaveTextContent('Version 1.2 of Spoons Collector is out.');
    expect(screen.getByRole('link', { name: 'Get it' })).toHaveAttribute('href', release.html_url);
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
