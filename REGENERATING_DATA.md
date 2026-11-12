# Regenerating Spoons Data

Run the following three scripts in order from the project root to pick up new spoons from OpenStreetMap and produce a fresh production dataset.

On a fresh clone, `spoons.json` and `spoons_fixed.json` are already present, so you can go straight to step 3. The app's dataset (`spoons_enriched.json`) and the photos (`public/images`) are not in the repository, because they hold content copied from the Wetherspoon website.

---

## Before you start

- **Node.js 20 or later**, then `npm install`.
- **`cwebp`**, used by step 3 to resize the photos: `brew install webp`.
- **The ONS Postcode Directory**, used by step 3 to work out each pub's region. It is too large for git (about 800 MB), so download it yourself from the [ONS Open Geography Portal](https://geoportal.statistics.gov.uk/) (search for "ONS Postcode Directory"). Either works:
  - the *Online ONS Postcode Directory (Live)*, downloaded as CSV;
  - the latest quarterly *ONS Postcode Directory (ONSPD)* zip. Use the CSV in its `Data` folder (e.g. `ONSPD_NOV_2026_UK.csv`).

  Put the CSV in `./assets`. `enrich.js` finds it by name, so there is no need to rename it, and git ignores CSV files in `./assets`. A newer download replaces an older one; delete the old file so only one is there.

---

## Step 1 — Fetch fresh data from OpenStreetMap

`build-spoons.js` queries OSM via the Overpass API and writes the raw dataset. This is useful to pick up any new spoons that have opened.

```bash
node build-spoons.js
```

- **Output:** `./assets/spoons.json`
- Automatically tries multiple Overpass API mirrors if one fails.

---

## Step 2 — Fix & clean the raw data

`fix.js` applies corrections to the raw OSM data.

```bash
node fix.js
```

- **Input:** `./assets/spoons.json`
- **Output:** `./assets/spoons_fixed.json`
- Applies missing postcodes from `missing_postcodes.json`
- Applies missing websites from `websites.json`
- Applies corrected town names from `cities.json`
- Removes closed/sold pubs listed in `dead_spoons.json`
- Applies history text from `missing_history.json` and photo links from `images.json`, for pubs whose Wetherspoon page lacks them

---

## Step 3 — Enrich with regions & pub history

`enrich.js` adds UK region identifiers and scrapes pub history from each pub's website.

```bash
node enrich.js
```

- **Input:** `./assets/spoons_fixed.json`
- **Output:** `./assets/spoons_enriched.json` *(final production dataset)*
- Assigns one of the 12 valid UK regions to each pub
- Scrapes and attaches pub history text from each pub's website URL
- Scrapes the pub's image details and downloads the full-size photo to `./assets/images_original`
- Saves a 600px-wide WebP copy of each photo to `./public/images`, which is what the app serves
- Calculates each pub's rarity from the distance to its nearest neighbour

Both image folders name files by the pub's Wetherspoon id (`jdwId`), e.g. `1352.webp`, so a pub keeps its photo when it is redrawn in OpenStreetMap and gets a new OSM id. Only `public/images` ends up in the site and the Android app; the originals stay out of the build.

The resizing needs `cwebp`. The script stops before doing anything if it is missing:

```bash
brew install webp
```

Only pubs that are new, or whose website URL has changed, are scraped. Everything else reuses the history and image details from the previous `spoons_enriched.json`, so a routine refresh takes a few minutes. Scraping pauses 10 seconds per pub, as the Wetherspoon site's `robots.txt` asks, so allow a minute for every 6 new pubs. The first run on a fresh clone has nothing to reuse and fetches all ~800 pubs, which takes about 2½ hours.

- **Interrupted run:** just run it again. Pages already scraped are kept in `./assets/enrich_progress.json` and are not fetched twice. `spoons_enriched.json` is only written when a run completes.
- **Force a full re-scrape** (about 2½ hours), to pick up changed history text or new photos:

  ```bash
  node enrich.js --refresh
  ```

- The run ends with a list of pubs added, removed and re-mapped in OSM since the last run, and any pubs left without a history, an image or a Wetherspoon id. A pub with no Wetherspoon id is left out of the app, because visits are recorded against that id. That usually means the pub's website URL is out of date: correct it in `websites.json`, or supply the missing piece in `missing_history.json` / `images.json`, then re-run steps 2 and 3.