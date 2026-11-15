import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** A Blob's contents as base64, without the data: URL prefix */
export const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const isCancel = (error: unknown) =>
  (error instanceof Error && /cancel|abort/i.test(error.message)) ||
  (error instanceof DOMException && error.name === 'AbortError');

/**
 * Shares a file (e.g. an image): the share sheet on a phone, the browser's
 * own sharing where it can share files, otherwise a download.
 * @returns 'cancelled' if the user closed the share sheet
 */
export const shareFile = async (
  blob: Blob,
  fileName: string,
  title: string,
): Promise<'shared' | 'downloaded' | 'cancelled'> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const { uri } = await Filesystem.writeFile({
        path: fileName,
        data: await blobToBase64(blob),
        directory: Directory.Cache,
      });
      await Share.share({ title, files: [uri], dialogTitle: title });
      return 'shared';
    }
    const file = new File([blob], fileName, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return 'shared';
    }
  } catch (error) {
    if (isCancel(error)) return 'cancelled';
    throw error;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return 'downloaded';
};

/**
 * Shares a message: the share sheet on a phone or where the browser has
 * one, otherwise copied to the clipboard.
 * @returns 'cancelled' if the user closed the share sheet
 */
export const shareText = async (text: string, title: string): Promise<'shared' | 'copied' | 'cancelled'> => {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ title, text });
      return 'shared';
    }
  } catch (error) {
    if (isCancel(error)) return 'cancelled';
    throw error;
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
};
