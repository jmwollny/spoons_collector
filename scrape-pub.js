import { extractHistory } from './fetch-history.js';
import { extractImageDetails } from './get-image.js';
import { USER_AGENT } from './user-agent.js';

const HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5'
};

/**
 * Fetches a pub's page from the Wetherspoon site once and extracts everything
 * the enrichment needs from it: the history text and the image details.
 * @param {string} url - The target Wetherspoon pub webpage
 * @returns {Promise<{history: string|null, image: {jdwId: number|null, imgUrl: string|null, imgType: string|null}}|null>}
 *   null when the page could not be fetched
 */
const scrapePub = async (url) => {
  try {
    const response = await fetch(url, { method: 'GET', headers: HEADERS });

    if (!response.ok) {
      throw new Error(`Failed to reach page. Status code: ${response.status}`);
    }

    const html = await response.text();
    const history = extractHistory(html);

    if (!history) {
      console.log(`⚠️ Cannot find history paragraph in url:${url}`);
    }

    return { history, image: extractImageDetails(html) };
  } catch (error) {
    console.error(`❌ Scraping Error for ${url}:`, error.message);
    return null;
  }
};

export default scrapePub;
