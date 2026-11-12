import fs from 'fs';
import readline from 'readline';
import scrapePub from './scrape-pub.js';
import calculateRarity from './calc-rarity.js';
import {
  checkImageTools,
  downloadImage,
  getOptimisedFilePath,
  getOriginalFilePath,
  optimiseImage,
} from './get-image.js';

// --- Config ---
// The ONS Postcode Directory CSV, downloaded into ./assets (see
// REGENERATING_DATA.md). Found by name so a newer download works as-is.
const ONS_CSV_PATTERN = /(ONS.*Postcode.*Directory|ONSPD).*\.csv$/i;
const SPOONS_IN = './assets/spoons_fixed.json';
const SPOONS_OUT = './assets/spoons_enriched.json';
// Pages scraped so far in the current run, so an interrupted run can resume.
// Deleted once the run completes.
const PROGRESS_FILE = './assets/enrich_progress.json';
// Delay after each request to the Wetherspoon site, matching the
// `Crawl-delay: 10` in https://www.jdwetherspoon.com/robots.txt
const SCRAPE_DELAY_MS = 10000;
// `node enrich.js --refresh` re-scrapes every pub instead of reusing the
// history and image details in the previous spoons_enriched.json
const REFRESH = process.argv.includes('--refresh');

// --- RGN25CD code → region name ---
const REGION_CODES = {
  E12000001: 'North East',
  E12000002: 'North West',
  E12000003: 'Yorkshire and the Humber',
  E12000004: 'East Midlands',
  E12000005: 'West Midlands',
  E12000006: 'East of England',
  E12000007: 'London',
  E12000008: 'South East',
  E12000009: 'South West',
  W99999999: 'Wales',
  S99999999: 'Scotland',
};

function getRegion(postcode, regionMap) {
  const oc = outwardCode(postcode);
  if (oc.startsWith('BT')) {
    return 'Northern Ireland';
  }
  return regionMap.get(oc) ?? null;
}

// Extract outward code from a full postcode e.g. "WF10 4TA" → "WF10"
function outwardCode(postcode) {
  if (!postcode) return '';
  return postcode.trim().split(' ')[0].toUpperCase();
}

// The directory's fields never contain commas, but some releases quote them
function splitCsvLine(line) {
  return line.split(',').map((cell) => cell.replace(/^"|"$/g, ''));
}

function findOnsCsv() {
  const file = fs.readdirSync('./assets').find((name) => ONS_CSV_PATTERN.test(name));
  if (!file) {
    throw new Error(
      'No ONS Postcode Directory CSV found in ./assets. Download it first: see REGENERATING_DATA.md.',
    );
  }
  return `./assets/${file}`;
}

// --- Step 1: Build outward code → region map from ONS CSV ---
async function buildRegionMap(csvPath) {
  const map = new Map();
  const rl = readline.createInterface({
    input: fs.createReadStream(csvPath),
    crlfDelay: Infinity,
  });

  let headers = null;
  let pcdsIdx, rgnIdx, dotermIdx;

  for await (const line of rl) {
    if (!headers) {
      // Column names vary between releases: 'PCDS' or 'pcds', and the region
      // column is 'RGN25CD' (year-suffixed) in the online directory but 'rgn'
      // in the downloadable ONSPD
      headers = splitCsvLine(line.replace(/^\uFEFF/, '')).map((h) => h.toLowerCase());
      pcdsIdx = headers.indexOf('pcds');
      rgnIdx = headers.findIndex((h) => /^rgn(\d{2}cd)?$/.test(h));
      dotermIdx = headers.indexOf('doterm');
      if (pcdsIdx === -1 || rgnIdx === -1 || dotermIdx === -1) {
        throw new Error(
          `${csvPath} is missing a postcode (PCDS), region (RGNxxCD) or termination date (DOTERM) column`,
        );
      }
      continue;
    }

    const cols = splitCsvLine(line);

    // Skip terminated postcodes
    if (cols[dotermIdx]) continue;

    const pcds = cols[pcdsIdx];
    const rgnCode = cols[rgnIdx];
    const region = REGION_CODES[rgnCode];

    if (pcds && region) {
      const oc = outwardCode(pcds);
      // Only set if not already set (first occurrence wins)
      if (!map.has(oc)) {
        map.set(oc, region);
      }
    }
  }

  console.log(`Built region map with ${map.size} outward codes`);
  return map;
}

// --- Step 2: Build website → scraped details cache ---
// Scraping is the slow part (one page every 5 seconds) and a pub's history and
// photo rarely change, so whatever was scraped before is reused: from the
// previous spoons_enriched.json and from the progress file of an interrupted
// run. Keyed on the website URL rather than the OSM id, which changes whenever
// a mapper redraws the pub.
function buildScrapeCache(previousSpoons) {
  const cache = new Map();

  if (!REFRESH) {
    for (const pub of previousSpoons) {
      if (!isScrapable(pub.website)) continue;

      const details = { history: null, image: null };
      if (pub.history && pub.history !== 'NONE') {
        details.history = pub.history;
      }
      // Overrides from images.json and missing_history.json are cached along
      // with scraped details. While an override exists it wins anyway; once it
      // is removed, its image and history keep being reused until a run with
      // --refresh fetches the pub's page again.
      if (hasPubImage(pub)) {
        details.image = {
          jdwId: pub.jdwId,
          imgUrl: pub.imgUrl,
          imgType: pub.imgType,
        };
      }
      cache.set(pub.website, details);
    }
    console.log(`Reusing scraped details for ${cache.size} pub pages from ${SPOONS_OUT}`);
  }

  const progress = loadProgress();
  const resumed = Object.entries(progress);
  for (const [website, details] of resumed) {
    cache.set(website, details);
  }
  if (resumed.length) {
    console.log(`Resuming an interrupted run: ${resumed.length} pages already scraped`);
  }

  return { cache, progress };
}

function isScrapable(website) {
  return Boolean(website) && website !== 'NONE';
}

// A pub's own page has both. When the website URL is out of date the site
// answers with a generic page instead, whose image is not a photo of the pub.
function hasPubImage(image) {
  return Boolean(image?.imgUrl && image?.jdwId);
}

function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) return {};
  return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
}

// Written via a temporary file so that being interrupted mid-write can't leave
// a truncated progress file behind
function saveProgress(progress) {
  const tempFile = `${PROGRESS_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(progress, null, 2));
  fs.renameSync(tempFile, PROGRESS_FILE);
}

const pause = () =>
  new Promise((resolve) => setTimeout(resolve, SCRAPE_DELAY_MS));

async function enrichSpoons(spoons, regionMap, previousSpoons) {
  const { cache, progress } = buildScrapeCache(previousSpoons);
  const previousImgUrls = new Map(
    previousSpoons
      .filter((pub) => pub.jdwId)
      .map((pub) => [pub.jdwId, pub.imgUrl]),
  );
  let matched = 0;
  let unmatched = [];
  let count = 0;
  let scrapedCount = 0;
  let reusedCount = 0;
  let downloadedCount = 0;
  let optimisedCount = 0;
  const missingHistory = [];
  const missingImage = [];
  const missingJdwId = [];
  const enriched = [];

  for (const pub of spoons) {
    let rarityStats = {};
    // Only pause when this pub actually cost a request
    let contactedSite = false;

    const region = getRegion(pub.postcode, regionMap);
    let updatedPub;

    if (region) {
      matched++;
      updatedPub = { ...pub, region };
    } else {
      unmatched.push(`${pub.name} (${pub.postcode || 'No Postcode'})`);
      updatedPub = { ...pub, region: null };
    }

    // The history and image in 'spoons_fixed.json' win. Anything still missing
    // comes from the cache, and the page is only fetched when that has a gap.
    let scraped = cache.get(updatedPub.website) ?? { history: null, image: null };
    const needsHistory = !updatedPub.history && !scraped.history;
    const needsImage = !updatedPub.imgUrl && !hasPubImage(scraped.image);

    if ((needsHistory || needsImage) && isScrapable(updatedPub.website)) {
      console.log(`[${count + 1}/${spoons.length}] Scraping ${updatedPub.name}: ${updatedPub.website}`);
      const page = await scrapePub(updatedPub.website);
      contactedSite = true;
      scrapedCount++;

      if (page) {
        // Keep what was already known where the page no longer has it
        scraped = {
          history: page.history ?? scraped.history,
          image: hasPubImage(page.image) ? page.image : (scraped.image ?? page.image),
        };
        cache.set(updatedPub.website, scraped);
        progress[updatedPub.website] = scraped;
        saveProgress(progress);
      }
    } else {
      reusedCount++;
    }

    const history = updatedPub.history || scraped.history || 'NONE';
    if (history === 'NONE') {
      missingHistory.push(`${updatedPub.name} (${updatedPub.id})`);
    }

    if (!updatedPub.rarity) {
      rarityStats = calculateRarity(updatedPub, spoons);
    } else {
      rarityStats = {
        rarity: updatedPub.rarity,
        nearestNeighborMiles: updatedPub.nearestNeighborMiles,
      };
    }

    // The scraped data contains the internal id used by Wetherspoons(jdwId), the pub image URL (imgUrl) and the extension(imgType).
    // Where the spoons site does not have the image, the imgUrl and imgType are
    // already on the pub from 'spoons_fixed.json' and are used directly.
    const imageDetails = updatedPub.imgUrl ? {} : (scraped.image ?? {});
    const jdwId = updatedPub.jdwId ?? imageDetails.jdwId ?? null;
    let imgUrl = null;
    let imgType = null;
    if (updatedPub.imgUrl) {
      ({ imgUrl, imgType } = updatedPub);
    } else if (hasPubImage(scraped.image)) {
      ({ imgUrl, imgType } = scraped.image);
    }

    if (!jdwId) {
      // The app tracks visits and finds images by this id
      missingJdwId.push(`${updatedPub.name} (${updatedPub.id})`);
    }

    let hasImage = false;
    if (imgUrl && jdwId) {
      const originalPath = getOriginalFilePath(jdwId, imgType);
      // The file on disk is the old photo if the pub's image URL has changed
      const imageChanged =
        previousImgUrls.has(jdwId) && previousImgUrls.get(jdwId) !== imgUrl;
      try {
        if (await downloadImage(imgUrl, originalPath, imageChanged)) {
          contactedSite = true;
          downloadedCount++;
        }
        if (optimiseImage(originalPath, getOptimisedFilePath(jdwId))) {
          optimisedCount++;
        }
        hasImage = true;
      } catch (error) {
        // One bad image shouldn't abort the whole run before anything is written
        console.error(`❌ Error preparing image for ${updatedPub.name} (${updatedPub.id}):`, error.message);
        contactedSite = true;
      }
    }
    if (!hasImage) {
      missingImage.push(`${updatedPub.name} (${updatedPub.id})`);
    }

    enriched.push({
      ...updatedPub,
      ...imageDetails,
      jdwId,
      // The app only shows a photo when this is set
      imgType: hasImage ? imgType : null,
      history,
      ...rarityStats,
    });

    count++;
    if (count % 100 === 0) {
      console.log(`Processed ${count} spoons so far.`);
    }

    if (contactedSite) {
      await pause();
    }
  }

  console.log(`Matched: ${matched} / ${spoons.length}`);
  if (unmatched.length) {
    console.log('Unmatched postcodes:');
    unmatched.forEach((u) => console.log(' -', u));
  }

  console.log(`Reused ${reusedCount} pubs, scraped ${scrapedCount} pages, downloaded ${downloadedCount} images, resized ${optimisedCount} images.`);
  if (missingJdwId.length) {
    console.log('⚠️  No Wetherspoon id, so the app cannot record visits (correct the URL in websites.json, or add a jdwId in images.json):');
    missingJdwId.forEach((m) => console.log(' -', m));
  }
  if (missingHistory.length) {
    console.log('No history (correct the URL in websites.json, or add the text to missing_history.json):');
    missingHistory.forEach((m) => console.log(' -', m));
  }
  if (missingImage.length) {
    console.log('No image (correct the URL in websites.json, or add one to images.json):');
    missingImage.forEach((m) => console.log(' -', m));
  }

  return enriched;
}

// Lists the pubs that joined or left the dataset since the last run. Pubs are
// matched on their Wetherspoon id, so one that was merely redrawn in OSM (and
// got a new OSM id) is reported as re-mapped rather than removed and added.
function reportChanges(previousSpoons, enriched) {
  const describe = (pub) => `${pub.name}, ${pub.city} (${pub.id})`;
  const pubKey = (pub) => (pub.jdwId ? `jdw:${pub.jdwId}` : `osm:${pub.id}`);
  const previousByKey = new Map(previousSpoons.map((pub) => [pubKey(pub), pub]));
  const currentKeys = new Set(enriched.map(pubKey));
  const added = enriched.filter((pub) => !previousByKey.has(pubKey(pub)));
  const removed = previousSpoons.filter((pub) => !currentKeys.has(pubKey(pub)));
  const remapped = enriched.filter((pub) => {
    const previous = previousByKey.get(pubKey(pub));
    return previous && previous.id !== pub.id;
  });

  if (added.length) {
    console.log(`Added since the last run (${added.length}):`);
    added.forEach((pub) => console.log(' +', describe(pub)));
  }
  if (removed.length) {
    console.log(`Removed since the last run (${removed.length}):`);
    removed.forEach((pub) => console.log(' -', describe(pub)));
  }
  if (remapped.length) {
    console.log(`New OSM id since the last run (${remapped.length}):`);
    remapped.forEach((pub) =>
      console.log(' ~', `${describe(pub)}, was ${previousByKey.get(pubKey(pub)).id}`),
    );
  }
}

// --- Main ---
async function main() {
  checkImageTools();

  console.log('Reading ONS CSV...');
  const regionMap = await buildRegionMap(findOnsCsv());

  console.log('Reading spoons info...');
  const spoons = JSON.parse(fs.readFileSync(SPOONS_IN, 'utf8'));
  const previousSpoons = fs.existsSync(SPOONS_OUT)
    ? JSON.parse(fs.readFileSync(SPOONS_OUT, 'utf8'))
    : [];

  console.log('Enriching...');
  const enriched = await enrichSpoons(spoons, regionMap, previousSpoons);

  fs.writeFileSync(SPOONS_OUT, JSON.stringify(enriched, null, 2));
  fs.rmSync(PROGRESS_FILE, { force: true });
  console.log(`Done! Written to ${SPOONS_OUT}`);
  if (previousSpoons.length) {
    reportChanges(previousSpoons, enriched);
  }
}

main().catch(console.error);
