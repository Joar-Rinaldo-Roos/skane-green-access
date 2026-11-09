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
| Geology | SGU soil geology WMS map overlay; no underlying feature query or site-specific interpretation yet | SGU Jordarter 1:25 000–1:100 000 |

**Limitations:** The Geology map displays WMS imagery, not interpreted site measurements. History and Culture currently return the same broad nearby Wikipedia dataset. This is an honest first integration, not yet a reliable topic classifier. Wikipedia's geotagged coverage varies. Nature records represent observations, not a live species inventory. Astronomy gives calculated solar times, not actual sky visibility. Facts are sourced, not generated. The site does not provide location-based safety or navigation advice.

## Run locally

The current app is **static HTML/CSS/JavaScript** and requires no Python dependencies:

```bash
python -m http.server 8000
```

Open `http://localhost:8000` on the same device. On Android, you can run this command from Termux inside the repository directory. Or host the static files with GitHub Pages.

### Host on GitHub Pages

Repository **Settings → Pages → Deploy from a branch → main → /(root)**. After publishing, open the HTTPS Pages URL on your Samsung phone. GitHub Pages availability for private repositories depends on your plan and settings.

GPS access needs browser permission and a secure context (HTTPS or localhost). A manual place search works without GPS. The app sends the location coordinates to the selected public APIs when querying. No app account or database is used.

## Technology

- Responsive HTML, CSS and vanilla JavaScript
- Leaflet 1.9.4, OpenStreetMap map tiles, and SGU OGC WMS soil geology overlay
- Browser Geolocation API
- OpenStreetMap Nominatim for Swedish place search
- Wikipedia MediaWiki geosearch and article extracts
- iNaturalist observations/species counts
- sunrise-sunset.org solar calculations

Public APIs may rate-limit, fail, or have browser CORS restrictions. Live end-to-end behavior on a Samsung device **has not been verified**.

## Roadmap

- [ ] Verify mobile API requests and GPS on an actual device
- [ ] Add real history/culture topic classification and heritage records from Riksantikvarieämbetet
- [x] Add SGU soil geology WMS overlay to the map
- [ ] Add underlying geology feature queries and explanatory research
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
- **Globe**: Optional world-scale MapLibre GL JS 6.16.0 globe using OpenStreetMap raster tiles. The globe requires WebGL; it shows the same selected-location marker but not SGU geology. Choose **Street map** to return to geology.
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

### Globe and SGU troubleshooting

The OSM background provides street context; SGU's WMS provides the OGC geology overlay. Neither OSM nor the globe itself is an OGC geology service. The SGU layer displays only on the **street map**. You can use **🌐 Globe** to rotate and zoom the Earth, then **🗺️ Street map** to return. It requires a browser with WebGL.

If SGU tiles are delayed, the map now displays a clear message after 12 seconds instead of staying indefinitely at "Loading". Image request failures and successful requests have distinct messages. A successful image response does **not** prove there is colourful geology at a specific point: SGU's scale-dependent rendering and map coverage can produce transparent images.

To compare directly with SGU, use **Open SGU’s original map** beneath the map. The WMS URL, layer name, and EPSG:3857 coordinate support agree with SGU's service documentation, but mobile-origin requests and pixel rendering still need testing on a live network.


## Troubleshooting on your Samsung

Open **Diagnostics & error logs** at the bottom of the site. Tap **Check browser**, reproduce the problem, then tap **Copy error report**. This stores recent status messages in the current browser tab and does not upload GPS coordinates or the text of questions. Inspect the report before sharing it. For full network responses, inspect Chrome on a computer (`F12`) or remote-debug Android with `chrome://inspect/#devices`.

**Find me** requests GPS access on user tap, rather than prompting without context on page load. If Chrome already blocked GPS, enable Location for this website in Chrome site settings. **Map center** allows using Discover without location permission or place-search services. GPS is cached within the session, so Discover will not repeatedly ask after a successful Find me.


### Runtime crash fix — global location and MapLibre v6
- The previous `let location` conflicted with the browser's built-in `location` property (notably in Safari), preventing `app.js` from running. Discovery state now uses `selectedLocation`; browser location access still works through `navigator.geolocation`.
- MapLibre GL JS v6 removed the old `dist/maplibre-gl.js` browser bundle. `globe-loader.mjs` now imports the documented v6 `dist/maplibre-gl.mjs` module and exposes it to the existing globe code; a failed optional globe import is reported through Diagnostics and does not stop the discovery interface.
- On phones, **Find me** or Discover in GPS mode triggers the browser location-permission request. If location is blocked, use **Map center** (or enable location access in browser site settings).
- Automated regression tests check these cases but cannot guarantee live browser connectivity, MapLibre WebGL support, or SGU WMS tile availability.
