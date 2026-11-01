# Here & Now — location-based curiosity app

**Here & Now** is a responsive, browser-based discovery app that answers: **“What is interesting about where I am?”**

Choose your **current GPS location** or search for a **place in Sweden**, then choose a topic. The app fetches information from linked public sources and presents one discovery at a time.

## Topics and live data

| Topic | Current implementation | Source |
| --- | --- | --- |
| Surprise me | Nearby geotagged articles in random order | Wikipedia MediaWiki API |
| History | Nearby geotagged articles (not strictly classified by historical topic yet) | Wikipedia MediaWiki API |
| Culture | Nearby geotagged articles (not strictly classified by cultural topic yet) | Wikipedia MediaWiki API |
| Nature | Species recorded within 10 km, not guaranteed present now | iNaturalist species counts API |
| Astronomy | Today's sunrise, sunset and solar noon | sunrise-sunset.org API |
| Geology | **Not implemented** — shown as unavailable | Future SGU integration |

**Limitations:** History and Culture currently return the same broad nearby Wikipedia dataset. This is an honest first integration, not yet a reliable topic classifier. Wikipedia's geotagged coverage varies. Nature records represent observations, not a live species inventory. Astronomy gives calculated solar times, not actual sky visibility. Facts are sourced, not generated. The site does not provide location-based safety or navigation advice.

## Run locally

The new app is **static HTML/CSS/JavaScript** and requires no Python dependencies:

```bash
python -m http.server 8000
```

Open `http://localhost:8000` on the same device. On Android, you can run this command from Termux inside the repository directory. Or host the static files with GitHub Pages.

### Host on GitHub Pages

Repository **Settings → Pages → Deploy from a branch → main → /(root)**. After publishing, open the HTTPS Pages URL on your Samsung phone. GitHub Pages availability for private repositories depends on your plan and settings.

GPS access needs browser permission and a secure context (HTTPS or localhost). A manual place search works without GPS. The app sends the location coordinates to the selected public APIs when querying. No app account or database is used.

## Technology

- Responsive HTML, CSS and vanilla JavaScript
- Browser Geolocation API
- OpenStreetMap Nominatim for Swedish place search
- Wikipedia MediaWiki geosearch and article extracts
- iNaturalist observations/species counts
- sunrise-sunset.org solar calculations

Public APIs may rate-limit, fail, or have browser CORS restrictions. Live end-to-end behavior on a Samsung device **has not been verified**.

## Roadmap

- [ ] Verify mobile API requests and GPS on an actual device
- [ ] Add real history/culture topic classification and heritage records from Riksantikvarieämbetet
- [ ] Add Swedish geology from SGU's open datasets
- [ ] Add richer astronomy and seasonal context
- [ ] Add radius control, source details, bookmarks and caching
- [ ] Add tests, deployment checks and accessibility improvements

## Previous prototype

This repository began as a Skåne green-space proximity project. Its original Python files (`analysis.py`, `app.py`, `download.py`, `demo.py`, `tests/`) are retained for reference and have **not** been incorporated into Here & Now. The original prototype's live OSM/Streamlit integration has not been validated end-to-end.

## Attribution

Wikipedia content is provided by Wikipedia contributors; follow linked article license terms. OpenStreetMap geocoding © OpenStreetMap contributors. iNaturalist observations are subject to their individual licenses.

## Phase 1 — mobile map and an actual OGC layer

The interactive map is now displayed above the existing discoveries, even when reading a result:

- **Street map**: OpenStreetMap tiles via Leaflet 1.9.4, with attribution and mobile pan/zoom.
- **Find me**: requests one-time browser GPS permission when tapped, places a location marker and a GPS accuracy circle, and recenters the map. No continuous tracking.
- **Choose a place**: searching for a Swedish place moves the same map marker. The map opens at **Lund only as an example**, not as a claimed GPS reading.
- **Soil geology**: toggle SGU's published OGC **WMS 1.3.0** map layer `jord:SE.GOV.SGU.JORD.GRUNDLAGER.25K` (Jordarter 1:25 000–1:100 000). WMS serves map images; it is **not** yet a query of underlying geology attributes. The Geology discovery topic shows an honest map-only description, not invented facts.

OGC service: https://resource.sgu.se/service/wms/130/jordarter-25-100-tusen  
SGU product description: https://www.sgu.se/produkter-och-tjanster/geologiska-data/jordarter--geologiska-data/jordartsdata/

The map relies on Leaflet from the pinned unpkg CDN, OSM map tiles, and SGU WMS. Network access is required. Map errors should be reported in the status line instead of disabling other discovery features. Availability and cartographic coverage depend on upstream services.

### Deploy with GitHub Pages

A GitHub Actions workflow in `.github/workflows/pages.yml` deploys the static root files on push to `main` or manual run. To enable it:

1. In **Settings → Pages**, choose **GitHub Actions** as the build/deployment source.
2. Merge the map pull request into `main` and inspect **Actions → Deploy Here & Now to Pages**.
3. Open the resulting HTTPS URL on your Samsung browser; accept the location permission when prompted.

**Note:** GitHub Pages support for private repositories depends on the account and organization plan. If Pages is unavailable, host these static files on any HTTPS static host. Neither an OpenAI API key nor Python is needed for Phase 1.

### Samsung validation checklist (requires a real device)

- Open the live HTTPS page on your Samsung. Confirm the street map loads, tiles pan/zoom, and attribution is visible.
- Tap **Find me** and grant browser location access. Confirm the marker is near you, the accuracy circle is displayed when available, and the app does not move its marker until you ask again.
- Deny GPS permission, then use **Choose a place → Lund → Find**. Confirm the map recenters and a topic can still be discovered.
- Toggle **Soil geology** on and off; confirm SGU's mapped soil colors appear in a covered area and street tiles remain visible under the overlay.
- Temporarily disable the network; confirm map errors are explained and the discovery interface remains usable.

Automated checks or inspecting the desktop browser cannot replace testing live GPS and WMS tile rendering on a Samsung. This step is intentionally **not marked verified** until device testing is performed.

### Phase 1 limits

This does not yet implement historical archives, OGC API Features, a backend, GPT chat, or evidence-grounded site-specific geology. Those belong to later phases. The original Skåne Python prototype remains untouched.
