import fs from 'fs';
import { fileURLToPath } from 'url';
import { USER_AGENT } from './user-agent.js';

/**
 * Finds each pub's entry in the Wetherspoon site's pub histories, so a
 * shareable build of the app (which leaves the history text out) can load a
 * pub's history from the site's API when it's shown.
 *
 * The site is WordPress. Each pub (its post id is our jdwId) has a
 * pub-histories entry with the same slug, whose excerpt is the history text.
 * Both lists come from the API, 100 at a time: about 20 requests.
 *
 *   node history-ids.js   adds historyId to assets/spoons_enriched.json
 *
 * enrich.js does the same on every run.
 */

const API = 'https://www.jdwetherspoon.com/wp-json/wp/v2/';
// As enrich.js: the `Crawl-delay: 10` in the site's robots.txt
const DELAY_MS = 10000;
const SPOONS_FILE = './assets/spoons_enriched.json';

const pause = () => new Promise((resolve) => setTimeout(resolve, DELAY_MS));

/** Every item of a WordPress post type, with just the fields asked for */
const fetchAll = async (type, fields) => {
  const items = [];
  for (let page = 1; ; page++) {
    const response = await fetch(`${API}${type}?per_page=100&page=${page}&_fields=${fields}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!response.ok) {
      throw new Error(`Couldn't list ${type} (page ${page}): status ${response.status}`);
    }
    items.push(...(await response.json()));
    const pages = Number(response.headers.get('x-wp-totalpages')) || 1;
    console.log(`  ${type}: page ${page} of ${pages}`);
    if (page >= pages) return items;
    await pause();
  }
};

/**
 * Each pub's history id, by the pub's jdwId.
 * @returns {Promise<Map<number, number>>}
 */
export const fetchHistoryIds = async () => {
  console.log('Finding pub histories on the Wetherspoon site...');
  const pubs = await fetchAll('pubs', 'id,slug');
  await pause();
  const histories = await fetchAll('pub-histories', 'id,slug');
  const historyBySlug = new Map(histories.map((history) => [history.slug, history.id]));
  return new Map(
    pubs.filter((pub) => historyBySlug.has(pub.slug)).map((pub) => [pub.id, historyBySlug.get(pub.slug)]),
  );
};

/**
 * Sets historyId on each pub that has one; a pub not found keeps the id it
 * had, if any.
 * @returns {{pubs: object[], missing: string[]}}
 */
export const addHistoryIds = (pubs, historyIds) => {
  const missing = [];
  const updated = pubs.map((pub) => {
    const historyId = (pub.jdwId && historyIds.get(pub.jdwId)) ?? pub.historyId ?? null;
    if (!historyId) missing.push(`${pub.name} (${pub.id})`);
    return { ...pub, historyId };
  });
  return { pubs: updated, missing };
};

const main = async () => {
  const pubs = JSON.parse(fs.readFileSync(SPOONS_FILE, 'utf8'));
  const { pubs: updated, missing } = addHistoryIds(pubs, await fetchHistoryIds());
  fs.writeFileSync(SPOONS_FILE, JSON.stringify(updated, null, 2));
  console.log(`Added history ids to ${updated.length - missing.length} of ${updated.length} pubs.`);
  if (missing.length) {
    console.log('No history found on the site for:');
    missing.forEach((pub) => console.log(' -', pub));
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
