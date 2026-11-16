# Spoons Collector

Collect Wetherspoon pubs like trading cards. Every pub in the UK gets a card with its photo, its history and a rarity based on how isolated it is from other Wetherspoons. Log a visit and a star rating, and watch your collection grow on the map.

Built with React, Leaflet and Vite, with an Android build via Capacitor. Visits are stored on your device (in local storage, with a second copy in the app's own settings store), so there is no account or server. Back them up from the **Your visits** panel; backups include any crawl under way.

## Getting started

The repository holds the code and the OpenStreetMap-derived pub list, but **not** the pub photos or history text. Those come from the Wetherspoon website, whose terms don't allow republishing them, so each copy of the project downloads its own (see [Data sources and licences](#data-sources-and-licences)). The app won't build until you have done this once.

1. **Install the prerequisites:** Node.js 20 or later, and `cwebp` for resizing the photos.

   ```bash
   brew install webp
   npm install
   ```

2. **Build the dataset.** The pub list from OpenStreetMap is already in the repository, so you only need the last step of the pipeline. The first run fetches every pub's page from the Wetherspoon website at one page every 10 seconds, so it takes about 2½ hours. If it is interrupted, run it again and it carries on where it stopped.

   ```bash
   node enrich.js
   ```

   This writes `assets/spoons_enriched.json` and the photos in `public/images`.

3. **Run the app** at http://localhost:2112:

   ```bash
   npm run dev
   ```

### Tests

Every component, hook and module has tests (Vitest and Testing Library), from the crawl planner's maths to clicking through the app: logging and editing visits, filters, Near me, crawls, live location and backups.

```bash
npm test             # run once
npm run test:watch   # rerun on every change
npm run coverage     # with a coverage report (also written to coverage/)
```

Tests live next to what they test (`Visits.tsx` → `Visits.test.tsx`). Shared fixtures, browser stand-ins and a stand-in for the Leaflet map are in [src/test/](src/test/).

GitHub Actions runs the lint, tests and build on every push ([.github/workflows/ci.yml](.github/workflows/ci.yml)). The scraped pub data isn't in the repo, so CI uses [assets/spoons_sample.json](assets/spoons_sample.json), a few made-up pubs in the same format. You can do the same to try the app without running the pipeline:

```bash
cp assets/spoons_sample.json assets/spoons_enriched.json
```

### Android

```bash
npm run build
npx cap sync android
npx cap open android
```

To build a signed APK to install on a phone, see [RELEASING.md](RELEASING.md).

## How it works

### Rarity

A pub's rarity comes from the distance to its **second**-nearest other Wetherspoon. Using the second-nearest means a pair of pubs in an otherwise isolated town (like Carlisle's two, 0.06 miles apart with the next 17 miles away) count as rare, rather than making each other Common.

| Rarity | Second-nearest Wetherspoon |
|---|---|
| Common | under 2¼ miles |
| Uncommon | 2¼–4½ miles |
| Rare | 4½–9 miles |
| Epic | 9–16 miles |
| Legendary | 16 miles or more |

Flip a card to see both distances.

### Visits

Each visit records the date and a rating, and optionally what you drank, who you were with, notes and a photo. On a phone, adding a photo offers the camera or the gallery. Photos are shrunk to about 1,280 pixels and kept on the device: as files in the Android app's own folder, or in IndexedDB in a browser. Backups include everything except photos, which would make them very large.

**Your stats** shows visits per month, your best year, weekly streaks, your favourite and most remote pubs, and the visit furthest from your usual patch. **Year in Spoons** sums up a year as a card you can share as an image.

### Crawls

**Plan a crawl** picks 2 to 10 pubs (new to you, the rarest within reach, or any), starting from a pub, your location or a town, and puts them in the shortest order. Each stop gets an arrival time and a meal (from Wetherspoon's usual food times).

- **Scores:** each pub ticked off scores by rarity (10 for Common up to 100 for Legendary), doubled if it's new to you, plus 10 for a breakfast, lunch or dinner stop. Finished crawls count towards the crawl achievements (Crawler, Full English, Marathon, Treasure Hunter, High Scorer).
- **Treasure hunt:** the pub names are hidden. Each stop shows a clue from its history with its name and town blanked out. Found stops score half as much again; **Reveal** gives up and shows the pub.
- **Sharing:** **Share** sends friends a code (`SC1.…`) and a `spoonscollector://crawl/…` link that opens the Android app. They join it from **Plan a crawl → Join a friend's crawl**, or `?crawl=…` on the web.
- **Follow the streets:** distances and times along real streets come from the [FOSSGIS routing service](https://routing.openstreetmap.de/) (the one openstreetmap.org's directions use). Only the pubs' locations are sent, never yours: the leg from your location to the first pub stays a straight line, though like any website the service sees your IP address and keeps server logs. Its [usage policy](https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/) asks for attribution and a "fix the map" link (shown in the crawl panel), at most one request a second, and no heavy use; the app makes one request per crawl. There's no guaranteed uptime, so the app falls back to straight lines. Untick it to stay offline.

### Regions

Each pub is assigned a region from the first half of its postcode, using a lookup built from the ONS Postcode Directory (`assets/postcode_regions.json`). There are 12 regions: North East, North West, Yorkshire and the Humber, East Midlands, West Midlands, East of England, London, South East, South West, Wales, Scotland and Northern Ireland.

### Data pipeline

The pub list comes from OpenStreetMap and is cleaned up with hand-maintained override files before being enriched. Run the scripts from the project root; [REGENERATING_DATA.md](REGENERATING_DATA.md) covers each step in detail.

```
OpenStreetMap (Overpass API)
        │
        ▼
build-spoons.js ──► assets/spoons.json          raw pub list
        │
        ▼
fix.js ◄── override files ──► assets/spoons_fixed.json
        │
        ▼
enrich.js ◄── assets/postcode_regions.json, Wetherspoon website
        │
        ├──► assets/spoons_enriched.json        what the app loads
        └──► public/images/<id>.webp            pub photos
```

| Override file | What it does |
|---|---|
| `assets/dead_spoons.json` | Removes pubs that have closed or been sold |
| `assets/missing_postcodes.json` | Supplies postcodes missing from OpenStreetMap |
| `assets/cities.json` | Supplies or corrects town names |
| `assets/websites.json` | Corrects out-of-date Wetherspoon page links |
| `assets/missing_history.json` | History text for pubs whose page has none |
| `assets/images.json` | Photo links for pubs whose page has none |

All override files are keyed by OpenStreetMap id.

Pubs, visits and photo file names use Wetherspoon's own pub id rather than the OpenStreetMap id, because a pub's OpenStreetMap id changes whenever someone redraws it on the map.

## Data sources and licences

- **Pub locations and names:** © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, available under the [Open Database Licence](https://opendatacommons.org/licenses/odbl/). The files in `assets` derived from it (`spoons.json`, `spoons_fixed.json` and the override files) are shared under the same licence.
- **Regions:** `assets/postcode_regions.json` is derived from the ONS Postcode Directory. Source: Office for National Statistics, licensed under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). Contains OS data © Crown copyright and database right. Contains Royal Mail data © Royal Mail copyright and database right.
- **Pub photos and history text:** © J D Wetherspoon plc. They are not included in this repository. `enrich.js` fetches them from the public Wetherspoon website for your own personal use. It identifies itself with its own user agent and waits 10 seconds between requests, as the site's `robots.txt` asks. Don't publish or redistribute the results.

This is a personal hobby project. It is not affiliated with or endorsed by J D Wetherspoon plc.
