import fs from 'fs';
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
// Outward code → region lookup, built from the ONS Postcode Directory by
// build-regions.js
const REGIONS_FILE = './assets/postcode_regions.json';
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

// --- Step 1: Load the outward code → region lookup ---
function loadRegionMap() {
  if (!fs.existsSync(REGIONS_FILE)) {
    throw new Error(
      `${REGIONS_FILE} is missing. Rebuild it with 'node build-regions.js': see REGENERATING_DATA.md.`,
    );
  }
  const regions = JSON.parse(fs.readFileSync(REGIONS_FILE, 'utf8'));
  return new Map(Object.entries(regions));
}

// --- Step 2: Build website → scraped details cache ---
// Scraping is the slow part (one page every 10 seconds) and a pub's history and
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

  const regionMap = loadRegionMap();

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
