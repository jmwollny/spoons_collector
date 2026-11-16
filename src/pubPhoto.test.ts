import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { pubPhotoUrl, usePubPhotoUrl } from './pubPhoto';
import { resetPubPhotoCache } from './pubPhotoCache';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false), convertFileSrc: (uri: string) => `app://${uri}` },
}));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { getUri: vi.fn(), readdir: vi.fn(), writeFile: vi.fn() },
  Directory: { Cache: 'CACHE' },
}));

const pub = { id: 7, imgType: 'jpg', imgUrl: 'https://www.jdwetherspoon.com/7.jpg' };

describe('pubPhotoUrl', () => {
  it('uses our own copy by default', () => {
    expect(pubPhotoUrl(pub)).toBe('/images/7.webp');
  });

  it("uses Wetherspoon's site in a shareable build", () => {
    expect(pubPhotoUrl(pub, true)).toBe('https://www.jdwetherspoon.com/7.jpg');
  });

  it('has nothing for a pub without a photo', () => {
    expect(pubPhotoUrl({ ...pub, imgType: null }, false)).toBeNull();
    expect(pubPhotoUrl({ ...pub, imgType: null }, true)).toBeNull();
  });
});

// What fetch gives for a photo (jsdom's Blob, which its FileReader can read)
const photoResponse = (ok = true) =>
  ({ ok, blob: async () => new Blob(['jpeg bytes'], { type: 'image/jpeg' }) }) as Response;

describe('usePubPhotoUrl', () => {
  beforeEach(() => {
    resetPubPhotoCache();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Filesystem.getUri).mockResolvedValue({ uri: 'file:///cache/pub-photos' });
    vi.mocked(Filesystem.readdir).mockReset();
    vi.mocked(Filesystem.writeFile).mockReset().mockResolvedValue({ uri: '' });
    vi.stubGlobal('fetch', vi.fn(async () => photoResponse()));
  });
  afterEach(() => vi.unstubAllGlobals());

  const savedFiles = (...names: string[]) =>
    vi.mocked(Filesystem.readdir).mockResolvedValue({
      files: names.map((name) => ({ name }) as Awaited<ReturnType<typeof Filesystem.readdir>>['files'][number]),
    });

  it("in a shareable app, saves a photo the first time it's shown", async () => {
    vi.mocked(Filesystem.readdir).mockRejectedValue(new Error('Folder does not exist'));
    const { result } = renderHook(() => usePubPhotoUrl(pub, true));
    expect(result.current).toBe('https://www.jdwetherspoon.com/7.jpg');
    await waitFor(() =>
      expect(Filesystem.writeFile).toHaveBeenCalledWith({
        path: 'pub-photos/7.jpg',
        data: btoa('jpeg bytes'),
        directory: 'CACHE',
        recursive: true,
      }),
    );
    expect(fetch).toHaveBeenCalledWith('https://www.jdwetherspoon.com/7.jpg');
  });

  it('then uses the saved copy', async () => {
    savedFiles('7.jpg');
    const { result } = renderHook(() => usePubPhotoUrl(pub, true));
    await waitFor(() => expect(result.current).toBe('app://file:///cache/pub-photos/7.jpg'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('downloads only a couple of photos at a time, and each only once', async () => {
    savedFiles();
    let finish: (() => void)[] = [];
    vi.mocked(fetch).mockImplementation(
      () => new Promise((resolve) => finish.push(() => resolve(photoResponse()))),
    );
    const pubs = [1, 2, 3, 3].map((id) => ({ ...pub, id, imgType: 'png' }));
    pubs.forEach((each) => renderHook(() => usePubPhotoUrl(each, true)));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const first = finish;
    finish = [];
    first.forEach((done) => done());
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    finish.forEach((done) => done());
    await waitFor(() => expect(Filesystem.writeFile).toHaveBeenCalledTimes(3));
    expect(vi.mocked(Filesystem.writeFile).mock.calls.map(([options]) => options.path)).toEqual([
      'pub-photos/1.png',
      'pub-photos/2.png',
      'pub-photos/3.png',
    ]);
  });

  it("doesn't save a photo that failed to download", async () => {
    savedFiles();
    vi.mocked(fetch).mockResolvedValue(photoResponse(false));
    renderHook(() => usePubPhotoUrl(pub, true));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(Filesystem.writeFile).not.toHaveBeenCalled();
  });

  it('leaves the photo alone in a browser, or with our own copies', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    expect(renderHook(() => usePubPhotoUrl(pub, true)).result.current).toBe('https://www.jdwetherspoon.com/7.jpg');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    expect(renderHook(() => usePubPhotoUrl(pub, false)).result.current).toBe('/images/7.webp');
    expect(Filesystem.readdir).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
