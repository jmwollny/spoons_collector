import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { deletePhoto, fitWithin, loadPhotoUrl, savePhoto, shrinkPhoto } from './photos';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false), convertFileSrc: vi.fn((uri: string) => `app://${uri}`) },
}));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: vi.fn(), getUri: vi.fn(), stat: vi.fn(), deleteFile: vi.fn() },
  Directory: { Data: 'DATA' },
}));

const photo = new Blob(['jpeg bytes'], { type: 'image/jpeg' });

describe('photos in a browser', () => {
  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    URL.createObjectURL = vi.fn(() => 'blob:photo');
  });

  it('saves, loads and deletes photos by visit', async () => {
    expect(await loadPhotoUrl('v1')).toBeNull();
    await savePhoto('v1', photo);
    expect(await loadPhotoUrl('v1')).toBe('blob:photo');
    // (fake-indexeddb hands back a copy of jsdom's Blob without its methods,
    // so the bytes can't be read back here; real browsers return the Blob)
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    await deletePhoto('v1');
    expect(await loadPhotoUrl('v1')).toBeNull();
  });
});

describe('photos in the Android app', () => {
  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Filesystem.writeFile).mockReset().mockResolvedValue({ uri: 'file:///data/photos/v1.jpg' });
    vi.mocked(Filesystem.getUri).mockReset().mockResolvedValue({ uri: 'file:///data/photos/v1.jpg' });
    vi.mocked(Filesystem.stat).mockReset();
    vi.mocked(Filesystem.deleteFile).mockReset();
  });

  it("saves photos as files in the app's own folder", async () => {
    await savePhoto('v1', photo);
    expect(Filesystem.writeFile).toHaveBeenCalledWith({
      path: 'photos/v1.jpg',
      data: btoa('jpeg bytes'),
      directory: 'DATA',
      recursive: true,
    });
  });

  it('loads a photo as a URL the web view can show', async () => {
    vi.mocked(Filesystem.stat).mockResolvedValue({} as Awaited<ReturnType<typeof Filesystem.stat>>);
    expect(await loadPhotoUrl('v1')).toBe('app://file:///data/photos/v1.jpg');
  });

  it("has no photo when the file isn't on this phone", async () => {
    vi.mocked(Filesystem.stat).mockRejectedValue(new Error('File does not exist'));
    expect(await loadPhotoUrl('v1')).toBeNull();
  });

  it('deletes the file, not minding if it has gone', async () => {
    await deletePhoto('v1');
    expect(Filesystem.deleteFile).toHaveBeenCalledWith({ path: 'photos/v1.jpg', directory: 'DATA' });
    vi.mocked(Filesystem.deleteFile).mockRejectedValue(new Error('File does not exist'));
    await expect(deletePhoto('v2')).resolves.toBeUndefined();
  });
});

describe('shrinking photos', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fits a photo within 1,280 pixels, keeping its shape', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 960, height: 1280 });
    // Never enlarges
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('draws the photo smaller as a JPEG', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 4000, height: 3000, close }));
    const drawImage = vi.fn();
    const shrunk = new Blob(['small'], { type: 'image/jpeg' });
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: (callback: (blob: Blob) => void, type: string, quality: number) => {
        expect([type, quality]).toEqual(['image/jpeg', 0.8]);
        callback(shrunk);
      },
    };
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'canvas' ? (canvas as unknown as HTMLCanvasElement) : createElement(tag),
    );
    expect(await shrinkPhoto(photo)).toBe(shrunk);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1280, 960);
    expect(close).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('keeps the photo as it is if it cannot be shrunk', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('Unsupported')));
    expect(await shrinkPhoto(photo)).toBe(photo);
  });
});
