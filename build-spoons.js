import fs from 'fs';
import { getDistance } from './calc-rarity.js';
import { USER_AGENT } from './user-agent.js';

// Same-named elements closer together than this (~160 m) are treated as one pub
const DUPLICATE_RADIUS_MILES = 0.1;

// The query itself is allowed 60 seconds; give up on a mirror that has not
// answered shortly after that rather than waiting on it forever
const REQUEST_TIMEOUT_MS = 90000;

// How many times to go round the full list of mirrors, and how long to wait
// before each further round (overpass-api.de asks for a backoff when it is
// at capacity)
const RETRY_WAITS_MS = [0, 30000, 60000];

const queryWithMirror = async (mirror, query) => {
  const response = await fetch(mirror, {
    method: 'POST',
    // Fix 1: Properly url-encode the query as form data parameters
    body: new URLSearchParams({ data: query }),
    headers: {
      // overpass-api.de answers 406 to a browser User-Agent sent by a script;
      // it wants one that identifies the application
      'User-Agent': USER_AGENT,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // Returns the actual parsed data elements
  return await response.json();
};

const queryWithMirrors = async (mirrors, query) => {
  for (const wait of RETRY_WAITS_MS) {
    if (wait > 0) {
      console.log(`No mirror answered. Waiting ${wait / 1000}s before trying them again...`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }

    const data = await queryEachMirror(mirrors, query);
    if (data) {
      return data;
    }
  }

  throw new Error('All listed overpass mirrors failed to respond.');
};

// One pass over the mirrors; null when none of them returned a usable dataset
const queryEachMirror = async (mirrors, query) => {
  for (const mirror of mirrors) {
    try {
      console.log(`Attempting to fetch all spoons from mirror: ${mirror}`);
      const data = await queryWithMirror(mirror, query);
      // Overpass reports a timed-out or out-of-memory query as HTTP 200 with a
      // `remark` and an empty or partial element list, which would otherwise
      // overwrite spoons.json with next to nothing.
      if (data && data.remark) {
        throw new Error(`Overpass remark: ${data.remark}`);
      }
      if (data && data.elements && data.elements.length > 0) {
        console.log(`Successfully pulled dataset from: ${mirror}`);
        return data;
      }
      console.warn(`⚠️  Mirror ${mirror} returned no elements.`);
    } catch (error) {
      console.warn(`⚠️  Mirror ${mirror} failed: ${error.message}`);
    }

    // Quick 1-second pause before cycling to the next backup server
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return null;
};

const fetchAllSpoons = async () => {
  // Balanced mix of primary nodes and highly resilient community mirrors
  const mirrors = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];

  const query = `
    [out:json][timeout:60];
    area["ISO3166-1"="GB"]->.searchArea;
    (
      nwr["brand:wikidata"="Q6109362"](area.searchArea);
      nwr["brand"="J D Wetherspoon"](area.searchArea);
    );
    out center;
  `;

  try {
    /*
    North East
    North West
    Yorkshire and the Humber
    East Midlands
    West Midlands
    East of England
    London
    South East
    South West
    Wales
    Scotland

    RGN25CD     Region
    E12000001   North East
    E12000002   North West
    E12000003   Yorkshire and the Humber
    E12000004   East Midlands
    E12000005   West Midlands
    E12000006   East of England
    E12000007   London
    E12000008   South East
    E12000009   South West
    W99999999   Wales
    S99999999   Scotland

    A couple of other useful columns from your data:
    CTRY25CD — Country code (E92000001 = England, S92000003 = Scotland, W92000004 = Wales)
    PCDS — the cleanly formatted postcode (e.g. AB10 1AB) — probably the one to use as your key
    LAT / LONG — coordinates if you need them
    DOTERM — termination date; if this is populated the postcode is no longer active, so you may want to filter those out

    So your join key would be PCDS → look up RGN25CD → map to region name.
    */
    console.log('Fetching live Spoons data from OpenStreetMap...');
    console.log(`query: ${query}`)

    const data = await queryWithMirrors(mirrors, query);
    console.log(`Found ${data.elements.length} Spoons.`);
    console.log("Processing and cleaning spatial markers...");

    const mappedSpoons = data.elements.map((element) => {
      const tags = element.tags || {};
      const lat = element.lat || (element.center && element.center.lat) || 0;
      const lon = element.lon || (element.center && element.center.lon) || 0;
      const city = tags["addr:city"] || tags["addr:suburb"] || tags["addr:town"] || "Unknown";

      return {
        // Hotel rooms above a pub are often mapped as a separate element with no amenity tag
        isPub: Boolean(tags.amenity),
        spoon: {
          id: element.id,
          name: tags.name || 'NONE',
          city: city,
          postcode: tags['addr:postcode'] || 'NONE',
          lon: parseFloat(lon),
          lat: parseFloat(lat),
          website: tags.website || tags['contact:website'] || `NONE`,
          menu: tags['website:menu'] || `NONE`,
        },
      };
    });

    // Remove overlapping geometry cleanly: two elements are the same pub when
    // they share a name and sit within DUPLICATE_RADIUS_MILES of each other
    // (e.g. a pub and its hotel). Name + city alone is not enough - London has
    // three pubs called "The Moon Under Water" - and misses pairs whose city
    // tag differs or is absent. The pub element is kept over the hotel one.
    const kept = [];
    for (const candidate of mappedSpoons) {
      const index = kept.findIndex(
        (existing) =>
          existing.spoon.name === candidate.spoon.name &&
          getDistance(
            existing.spoon.lat,
            existing.spoon.lon,
            candidate.spoon.lat,
            candidate.spoon.lon,
          ) < DUPLICATE_RADIUS_MILES,
      );
      if (index === -1) {
        kept.push(candidate);
      } else if (!kept[index].isPub && candidate.isPub) {
        kept[index] = candidate;
      }
    }
    const uniqueSpoons = kept.map((item) => item.spoon);

    // Safeguard: Create assets directory if missing
    if (!fs.existsSync('./assets')) {
      fs.mkdirSync('./assets');
    }

    fs.writeFileSync(
      './assets/spoons.json',
      JSON.stringify(uniqueSpoons, null, 2),
      'utf-8'
    );

    console.log(`\n🎉 Success! Generated ./assets/spoons.json with ${uniqueSpoons.length} unique locations.`);
  } catch (error) {
    console.error('\n❌ Failed compiling Spoons data:', error.message);
  }
};

fetchAllSpoons();