# Spoons Collector

Collect Wetherspoon pubs like trading cards. Every pub in the UK gets a card with its photo, its history and a rarity based on how isolated it is from other Wetherspoons. Log a visit and a star rating, and watch your collection grow on the map.

Built with React, Leaflet and Vite, with an Android build via Capacitor. Visits are stored in your browser's local storage, so there is no account or server.

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

### Android

```bash
npm run build
npx cap sync android
npx cap open android
```

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
