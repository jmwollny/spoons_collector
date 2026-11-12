// Builds assets/postcode_regions.json, the lookup enrich.js uses to give each
// pub a region: postcode outward code (e.g. "WF10") → region name.
//
// Input is the ONS Postcode Directory CSV (about 1.5 GB), which only needs
// downloading to refresh the lookup: see REGENERATING_DATA.md. The lookup
// itself is small and committed, so this rarely needs running.
//
// Usage: node build-regions.js [path/to/ONSPD.csv]
// Without a path, it looks in ./assets for a file named like the directory.

import fs from 'fs';
import readline from 'readline';

const ONS_CSV_PATTERN = /(ONS.*Postcode.*Directory|ONSPD).*\.csv$/i;
const REGIONS_FILE = './assets/postcode_regions.json';

// Region codes (RGNxxCD) → region name. Northern Ireland postcodes (BT) are
// recognised by enrich.js directly, so they are not part of the lookup.
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
  if (process.argv[2]) {
    return process.argv[2];
  }
  const file = fs.readdirSync('./assets').find((name) => ONS_CSV_PATTERN.test(name));
  if (!file) {
    throw new Error(
      'No ONS Postcode Directory CSV found in ./assets. Download it, or pass its path: see REGENERATING_DATA.md.',
    );
  }
  return `./assets/${file}`;
}

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

async function main() {
  const csvPath = findOnsCsv();
  console.log(`Reading ${csvPath}...`);
  const map = await buildRegionMap(csvPath);

  // Sorted so a rebuild from a newer directory gives a readable diff
  const regions = Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(REGIONS_FILE, JSON.stringify(regions, null, 2) + '\n');
  console.log(`Written to ${REGIONS_FILE}`);
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
