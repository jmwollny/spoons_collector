# Regenerating Spoons Data

Run the following three scripts in order from the project root to pick up new spoons from OpenStreetMap and produce a fresh production dataset.

On a fresh clone, `spoons.json` and `spoons_fixed.json` are already present, so you can go straight to step 3. The app's dataset (`spoons_enriched.json`) and the photos (`public/images`) are not in the repository, because they hold content copied from the Wetherspoon website.

---

## Before you start

- **Node.js 20 or later**, then `npm install`.
- **`cwebp`**, used by step 3 to resize the photos: `brew install webp`.

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
- Assigns one of the 12 valid UK regions to each pub, from the first half of its postcode, using `./assets/postcode_regions.json`
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

---

## Optional — Refresh the region lookup

`assets/postcode_regions.json` maps the first half of each postcode (e.g. `WF10`) to its region. It is built from the ONS Postcode Directory and committed, so you normally never touch it. Postcode areas almost never change region; the one case for a refresh is a new pub whose postcode district is new, which step 3 reports under "Unmatched postcodes".

To rebuild it:

1. Download the latest *ONS Postcode Directory (ONSPD)* from the [ONS Open Geography Portal](https://geoportal.statistics.gov.uk/) (search for "ONS Postcode Directory"). The zip is about 250 MB; the CSV in its `Data` folder (e.g. `ONSPD_AUG_2026_UK.csv`) is about 1.5 GB.
2. Run:

   ```bash
   node build-regions.js path/to/ONSPD_AUG_2026_UK.csv
   ```

   Or put the CSV in `./assets` and run `node build-regions.js` with no path. Git ignores CSV files in `./assets`.
3. Re-run step 3, then delete the CSV. Only the small lookup is needed.

`build-regions.js` accepts the column names used by both the quarterly ONSPD and the *Online ONS Postcode Directory (Live)*. If a future release renames them again, it stops and names the missing column.
