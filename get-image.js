import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { pipeline } from 'stream/promises';
import { USER_AGENT } from './user-agent.js';

const HEADERS = {
  'User-Agent': USER_AGENT,
};

/**
 * Extracts the internal id used by Wetherspoons (jdwId), the pub image URL
 * (imgUrl) and its extension (imgType) from a JDW pub page
 * @param {string} html - The HTML of the Wetherspoon pub webpage
 */
export function extractImageDetails(html) {
  const $ = cheerio.load(html);

  // Extract the Internal Wetherspoons ID from the WP shortlink tag
  // e.g., "https://www.jdwetherspoon.com/?p=1156"
  const shortlink = $('link[rel="shortlink"]').attr('href');
  let jdwId = null;
  if (shortlink && shortlink.includes('?p=')) {
    jdwId = parseInt(shortlink.split('?p=')[1], 10);
  }

  const imgUrl = $('meta[property="og:image"]').attr('content') || null;
  const imgType = getImageType(imgUrl);

  return {
    jdwId,
    imgUrl,
    imgType,
  };
}

export function getImageType(imgUrl) {
  return imgUrl
    ? path.extname(new URL(imgUrl).pathname).replace(/^\./, '') || 'jpg'
    : null;
}

// Full-size photos as downloaded. Kept outside 'public' so they are never
// bundled into the site or the Android app.
const ORIGINALS_DIR = path.join('assets', 'images_original');
// The resized copies the app serves, as /images/<jdwId>.webp
const OPTIMISED_DIR = path.join('public', 'images');

// The photos are shown at most ~275px wide on a card; 600px keeps them sharp
// on high-density screens
const OPTIMISED_WIDTH = 600;
const WEBP_QUALITY = 75;

const ensureDir = (dir) => {
  const fullPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
  return fullPath;
};

// Images are named after the pub's Wetherspoon id rather than its OSM id,
// which changes whenever a mapper redraws the pub
export function getOriginalFilePath(jdwId, imgType) {
  return path.join(ensureDir(ORIGINALS_DIR), `${jdwId}.${imgType}`);
}

export function getOptimisedFilePath(jdwId) {
  return path.join(ensureDir(OPTIMISED_DIR), `${jdwId}.webp`);
}

/**
 * Fails early, before any scraping, if cwebp is not installed
 */
export function checkImageTools() {
  try {
    execFileSync('cwebp', ['-version'], { stdio: 'ignore' });
  } catch {
    throw new Error(
      'cwebp is needed to resize the pub images. Install it with: brew install webp',
    );
  }
}

/**
 * Writes the resized WebP copy of an original image
 * @returns {boolean} false when an up-to-date copy already existed
 */
export function optimiseImage(sourcePath, targetPath) {
  if (
    fs.existsSync(targetPath) &&
    fs.statSync(targetPath).size > 0 &&
    fs.statSync(targetPath).mtimeMs >= fs.statSync(sourcePath).mtimeMs
  ) {
    return false;
  }

  // Never enlarge a photo that is already smaller than the target width
  const width = Math.min(OPTIMISED_WIDTH, getImageWidth(sourcePath) ?? OPTIMISED_WIDTH);
  const tempPath = `${targetPath}.part`;
  try {
    execFileSync('cwebp', [
      '-quiet',
      '-q', String(WEBP_QUALITY),
      '-resize', String(width), '0',
      '-metadata', 'none',
      sourcePath,
      '-o', tempPath,
    ]);
    fs.renameSync(tempPath, targetPath);
    return true;
  } catch (error) {
    fs.rmSync(tempPath, { force: true });
    throw new Error(`cwebp could not convert ${sourcePath}: ${error.message}`);
  }
}

// Reads the width from a PNG or JPEG header; null for anything else
function getImageWidth(filePath) {
  const data = fs.readFileSync(filePath);
  // PNG: width is a big-endian uint32 at byte 16
  if (data.length > 24 && data.readUInt32BE(0) === 0x89504e47) {
    return data.readUInt32BE(16);
  }
  // JPEG: walk the segments to the start-of-frame marker
  if (data.length > 4 && data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < data.length) {
      const marker = data[offset + 1];
      const length = data.readUInt16BE(offset + 2);
      const isStartOfFrame =
        marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isStartOfFrame) {
        return data.readUInt16BE(offset + 7);
      }
      offset += 2 + length;
    }
  }
  return null;
}

/**
 * Downloads a binary image stream and writes it directly to disk
 * @param {boolean} overwrite - Replace an image that is already on disk
 * @returns {Promise<boolean>} false when the image was already on disk
 */
export async function downloadImage(url, filePath, overwrite = false) {
  // An empty file is the remains of a failed download, not an image to keep
  if (!overwrite && fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
    return false;
  }
  console.log(`Downloading image to: ${filePath}`);

  const response = await axios({
    url,
    method: 'GET',
    headers: HEADERS,
    responseType: 'stream',
  });

  // Write to a temporary file and rename once complete, so a failed or
  // interrupted download never leaves a file that later runs would skip.
  const tempPath = `${filePath}.part`;
  try {
    await pipeline(response.data, fs.createWriteStream(tempPath));
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (error) {
    fs.rmSync(tempPath, { force: true });
    throw error;
  }
}
