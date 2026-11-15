import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { blobToBase64, shareFile, shareText } from './files';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn(() => false) } }));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: { writeFile: vi.fn() }, Directory: { Cache: 'CACHE' } }));
vi.mock('@capacitor/share', () => ({ Share: { share: vi.fn() } }));

const image = new Blob(['png bytes'], { type: 'image/png' });

describe('blobToBase64', () => {
  it('reads a blob as base64', async () => {
    expect(await blobToBase64(image)).toBe(btoa('png bytes'));
  });
});

describe('shareFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('in the Android app', () => {
    beforeEach(() => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(Filesystem.writeFile).mockResolvedValue({ uri: 'file:///cache/card.png' });
      vi.mocked(Share.share).mockReset();
    });

    it('writes the file and opens the share sheet', async () => {
      vi.mocked(Share.share).mockResolvedValue({});
      expect(await shareFile(image, 'card.png', 'My card')).toBe('shared');
      expect(Filesystem.writeFile).toHaveBeenCalledWith({ path: 'card.png', data: btoa('png bytes'), directory: 'CACHE' });
      expect(Share.share).toHaveBeenCalledWith({ title: 'My card', files: ['file:///cache/card.png'], dialogTitle: 'My card' });
    });

    it('reports a closed share sheet', async () => {
      vi.mocked(Share.share).mockRejectedValue(new Error('Share canceled'));
      expect(await shareFile(image, 'card.png', 'My card')).toBe('cancelled');
    });

    it('passes on other failures', async () => {
      vi.mocked(Share.share).mockRejectedValue(new Error('No apps'));
      await expect(shareFile(image, 'card.png', 'My card')).rejects.toThrow('No apps');
    });
  });

  describe('in a browser', () => {
    beforeEach(() => vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false));

    it("uses the browser's sharing where it can share files", async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { canShare: () => true, share });
      expect(await shareFile(image, 'card.png', 'My card')).toBe('shared');
      expect(share.mock.calls[0][0].files[0].name).toBe('card.png');
    });

    it('treats a dismissed share as cancelled', async () => {
      vi.stubGlobal('navigator', {
        canShare: () => true,
        share: vi.fn().mockRejectedValue(new DOMException('Share dismissed', 'AbortError')),
      });
      expect(await shareFile(image, 'card.png', 'My card')).toBe('cancelled');
    });

    it('otherwise downloads the file', async () => {
      vi.stubGlobal('navigator', {});
      URL.createObjectURL = vi.fn(() => 'blob:card');
      URL.revokeObjectURL = vi.fn();
      let downloaded = '';
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        downloaded = this.download;
      });
      expect(await shareFile(image, 'card.png', 'My card')).toBe('downloaded');
      expect(downloaded).toBe('card.png');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:card');
    });
  });
});

describe('shareText', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the share sheet in the Android app', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Share.share).mockReset().mockResolvedValue({});
    expect(await shareText('Join me', 'Crawl')).toBe('shared');
    expect(Share.share).toHaveBeenCalledWith({ title: 'Crawl', text: 'Join me', dialogTitle: 'Crawl' });
    vi.mocked(Share.share).mockRejectedValue(new Error('Share canceled'));
    expect(await shareText('Join me', 'Crawl')).toBe('cancelled');
    vi.mocked(Share.share).mockRejectedValue(new Error('Broken'));
    await expect(shareText('Join me', 'Crawl')).rejects.toThrow('Broken');
  });

  it("uses the browser's sharing, or copies the message", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });
    expect(await shareText('Join me', 'Crawl')).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'Crawl', text: 'Join me' });

    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await shareText('Join me', 'Crawl')).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('Join me');
  });
});
