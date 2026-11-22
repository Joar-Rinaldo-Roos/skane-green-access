# Here & Now — location-based curiosity app

## Website version and release verification

**Current release: v1.0.3**. The version is shown in the top-right header, even if JavaScript fails to load. The authoritative release number is `version.json`; the header must match it and is checked with `node --test version.test.cjs`.

For the next website changes, bump the version to **v1.0.4** (and keep subsequent patch versions increasing), updating both `version.json` and the header. GitHub Pages will publish the manifest, too.

The deployment workflow now checks the actual public GitHub Pages URL after publishing and verifies that the served HTML contains both the expected version and the **🌡️ Temp** button. If it cannot verify those, deployment is reported as failing instead of assuming the new site is live. A public browser can still cache a previous page: if your header does not show the expected version, use the new release URL, refresh, or check GitHub Pages settings / Actions.



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


## ☁️ Global cloud cover forecast — v1.0.3 (November 2026)

- **☁️ Clouds** adds a global **total cloud cover** forecast layer on the existing 3D MapLibre globe. It reuses the working Open-Meteo MapLibre OM protocol renderer and the DWD ICON Global weather model. The data variable is `cloud_cover` (the predicted share of sky covered by clouds, **0% = clear, 100% = overcast**).
- Unlike live satellite photos, this is **numerical model forecast cloud cover**, which can diverge from the sky at any given location. Resolution remains global-model resolution even when zoomed in. A model forecast does not mean precipitation is expected.
- The **48-hour timeline** selects only timestamps actually present in the latest model metadata (`https://openmeteo.s3.amazonaws.com/data_spatial/dwd_icon/latest.json`), approximately every three hours. **▶ Play / Ⅱ Pause** animates through frames; the forecast-valid time and model-run reference time are visible.
- The MapLibre raster source uses `om://…/dwd_icon/latest.json?variable=cloud_cover&time_step=valid_times_N` at zoom levels from world to local, with a semi-transparent overlay. The source is not queried until Clouds is activated. No GPS, user coordinates, Mac backend, or API key is needed.
- **Clouds, Rain forecast and Temperature are exclusive weather overlays** to avoid blending unrelated colour scales, while SGU geology and Green Spaces remain available. Switching away pauses animation and hides the previous forecast overlay.
- Network/code tests: `node --test cloud-cover.test.cjs cloud-cover.browser.test.cjs` covers real forecast indices, raster URLs, toggle, slider and Play/Pause. GitHub Actions runs `node cloud-cover-smoke.mjs` to verify that `cloud_cover` is actually in the latest DWD ICON global metadata and that there are at least 36 hours of future forecasts. These checks cannot substitute for testing real graphics rendering on a Samsung/Android or Mac browser.
- Github Pages deployment checks that live HTML contains the expected v1.0.3 release number and **☁️ Clouds** button. The upstream Open-Meteo weather-map-layer library is experimental, and model/tiles may load slowly on mobile.

## 🌧️ Next rain at the map center — v1.0.2 (November 2026)

Here & Now now answers **“When will it rain next here?”** in a simple card directly beneath the map. It queries the **center of the active globe or 2D map**, not GPS; the initial map center defaults to Lund, and the user can pan anywhere and tap **↻ Update forecast** to get a forecast for that new center. Moving more than roughly 0.001° invalidates the old prediction instead of silently continuing to show it for the wrong place. The initial page load fetches the forecast automatically.

- Uses the public Open-Meteo hourly point forecast at `https://api.open-meteo.com/v1/forecast`, with `hourly=rain,showers,precipitation_probability`, `forecast_hours=48`, `timezone=UTC`, and `models=best_match`. This is a **location-specific best-match model**, distinct from the globe-wide DWD ICON visualization.
- `rain` covers large-scale rain and `showers` covers convective showers; both are combined. An hour counts as next measurable rain if predicted total reaches **at least 0.2 mm in one hour**. The API timestamps represent the **end of the preceding hour**. The card shows the full interval and predicted millimetres, and labels **precipitation probability** as probability of *any* precipitation, not necessarily rain.
- When the model forecasts no hours above the threshold, the card says so with a caveat; it does not claim certain dry conditions. Null or missing rain fields are not silently interpreted as zero. Rain likelihood and model forecasts can be wrong; this is **not live radar**.
- Open-Meteo time values are requested in UTC and shown in the **device's timezone**, explicitly labelled. Map coordinates sent to Open-Meteo are rounded to five decimal places for the forecast request, but app diagnostics avoid logging precise position. The displayed map-center label rounds coordinates to two decimal places.
- No GPS permission, optional Mac backend, or API key is needed. The card has a refresh button and an abort timeout; error messages appear on failure.
- Tests: `node --test next-rain.test.cjs next-rain.browser.test.cjs` covers forecast API request arguments, distinguishing rain from snow/precipitation probability, times and units, map-center selection, stale forecast invalidation, and network failures. `node next-rain-smoke.mjs` runs a live API call for Lund example coordinates in GitHub Actions; it **does not** access the user's location.
- The Pages deployment test checks that v1.0.2 and the Next Rain card are present in the publicly served HTML. Real browser/network behaviour should still be checked on a phone or Mac.

## 🌧️ Animated global rain forecast — v1.0.1 (November 2026)

Here & Now adds a **🌧️ Rain forecast** toggle to the existing **3D globe**. The layer uses the same Open-Meteo MapLibre weather renderer that powers the temperature map, but displays **DWD ICON Global model precipitation** (`precipitation`, with `rain` as a supported fallback). It is a forecast of **rain and snow combined**, not live radar or current observations.

- When enabled, the button switches the map to the globe if needed. **Green Spaces and SGU Geology are unchanged.** Temperature and precipitation are mutually exclusive colour overlays for clarity.
- Weather metadata comes from `https://openmeteo.s3.amazonaws.com/data_spatial/dwd_icon/latest.json`. The timeline uses only genuine `valid_times` from this file, selecting roughly three-hourly steps for **up to 48 hours**, skipping absent timesteps rather than fabricating values. The last available frame may be earlier than exactly +48 h.
- The timeline shows the model's actual forecast-valid time and reference/issuance time. **▶ Play / Ⅱ Pause** controls cycle through the time steps at 4.5-second intervals; the slider can select any frame. Playback stops at the end. Results aren't animated wind advection; successive model predictions create the apparent motion.
- MapLibre requests the relevant forecast frame with `om://.../latest.json?variable=precipitation&time_step=valid_times_N` and updates a raster tile source via `setUrl`. The same 3D layer is available from world scale down to city zoom, but **local precision remains limited by the global model resolution**.
- This prototype intentionally does not preload all frames (mobile memory and bandwidth). Switching rapidly between frames can cause visible delays or a temporarily blank map while the new forecast tiles load. Open-Meteo's weather-map-layer package is still experimental. The app may report errors if model data or the library becomes unavailable.
- This is a **static GitHub Pages site**; no secret API key or local Mac server is needed. User GPS coordinates are not sent to Open-Meteo for the global weather layer. The browser fetches model data based on visible globe tiles.
- Checks: `node --test rain-forecast.test.cjs` covers metadata filtering, frame bounds, source URLs, view styles, and playback end conditions; `node rain-forecast-smoke.mjs` checks live metadata for precipitation availability and future timesteps. These are not a substitute for on-device Samsung rendering checks.
- After publishing, GitHub Pages verifies that its live HTML contains `v1.0.1`, **🌡️ Temp** and **🌧️ Rain forecast**.

## 🌡️ Global temperature overlay (November 2026)

Here & Now's existing **MapLibre 3D globe** can display a **global forecast of air temperature at 2 metres above ground**. Tap **🌡️ Temp** above the globe. The temperature layer:
- Uses Open-Meteo's MapLibre `om://` protocol and DWD ICON **global** model (`temperature_2m`, closest current forecast hour). Model coverage is global and forecast resolution is finite; zooming into neighbourhoods does *not* create street-scale observations.
- Is a **numerical weather forecast**, not a real-time thermometer/radar or satellite measurement. The selected forecast validity time is shown where metadata is available.
- Is a semi-transparent raster overlay on the existing 3D globe. It is supported at world and local zoom levels without fetching individual GPS-based forecasts. No GPS permission or Mac backend is required.
- Only loads the weather renderer and model data if the user turns the layer on. Uses the pinned Open-Meteo weather-map-layer library version `0.3.2` from unpkg and model data from Open-Meteo's spatial repository. Weather attribution appears in the interface.
- If the globe is in 2D mode, enabling Temperature switches to 3D; the temperature overlay itself is intentionally **3D only** in this first phase. Green Spaces is unchanged.
- Is experimental: upstream Open-Meteo itself warns its map-layer API is not yet production-ready. The third-party library uses WebAssembly and worker assets, and may perform less smoothly on browsers without cross-origin isolation (GitHub Pages cannot configure custom cross-origin isolation headers in this workflow). Source: https://github.com/open-meteo/weather-map-layer
- No embedded API key. Open-Meteo's free access is intended for non-commercial use under its terms; consult licensing for other uses. Map library source is distributed under GPL-2.0; its license remains with its authors.
- Unit tests: `node --test temperature.test.cjs`. A separate GitHub Actions workflow probes current global model metadata and checks that CDN JS/worker/WASM assets exist. Browser performance, colors and global globe rendering still need Samsung testing.

## Green Spaces map overlay (November 2026)

**🌳 Green spaces** is a map toggle alongside the geology layer. It shows mapped **parks, gardens, forests, nature reserves and recreation green areas** on both the 3D MapLibre globe and 2D Leaflet map.

- Uses OpenStreetMap Overpass API to fetch nearby OSM ways and multipolygon relations on demand, within about **1.2 km of the visible map center** (at street-level zoom 12+).
- Converts closed OSM polygon geometries into GeoJSON and renders transparent colored shapes on both map views. Tap an area to see its mapped name/type and the original OSM object link.
- Updates when the map moves, with 15-second minimum request spacing, a 5-minute in-memory query cache, a capped output size, timeouts and a user-visible error message. The toggle starts **off** and does not fetch until selected.
- This visualizes **mapped green spaces, not measured green access**. The app does not yet compute walking routes, verify entry points or confirm public accessibility. Incomplete OSM tagging and unclosed multipolygon fragments may cause areas to be omitted.
- Data source: OpenStreetMap contributors via a public Overpass API instance. Its availability, CORS and rate limits can vary; no availability guarantee. Queries send the selected map center coordinates to Overpass.
- Tests: `node --test green-spaces.test.cjs`. The GitHub Actions CI runs these tests and syntax checks; Pages deployment also requires them to pass.
- Works independently of the Mac GPT backend. Actual Android browser/network rendering still requires on-device validation.

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


### SGU geology data source update
The old SGU WMS endpoint `resource.sgu.se/service/wms/130/jordarter-25-100-tusen` returned repeated image failures on the Samsung device. The primary geological overlay now uses SGU's separately published **OGC API – Features** `grundlager` endpoint, requesting GeoJSON polygons for the map viewport in longitude/latitude coordinates (CRS84):
`https://api.sgu.se/oppnadata/jordarter25k-100k/ogc/features/v1/collections/grundlager/items`.
The polygons carry `jg2_tx` (mapped soil-type text). Tapping coloured areas shows the actual source label; colours are illustrative, not official SGU symbology. Maps use a capped number of results per viewport, so zoom closer if the source has more than 180 features. Failed requests report the network/HTTP error in browser diagnostics. This feature relies on SGU's service and cross-origin browser access; successful rendering on a Samsung still needs live testing. The globe remains separate and does not render these geological features.


### Globe-first map revision
- **Globe is the preferred default** if MapLibre loads and WebGL is available. Otherwise Leaflet is a 2D fallback. MapLibre's globe is a rendering/projection choice; OpenStreetMap supplies background map data.
- **Find me** now zooms the active globe to its actual GPS point (zoom 15) instead of zoom 4. The marker appears in both modes.
- **SGU OGC Features** GeoJSON polygons are drawn on both 3D Globe and 2D map, with tappable real SGU soil descriptions. Validate coordinates and report when the API returns features but no drawable polygons.
- **2D gray tiles** are mitigated by not recentering Leaflet while it is hidden and by delaying Leaflet resize/invalidate after switching back.
- **Request throttling** reduces repeated SGU queries while panning to at most one after 800 ms of idle map movement; canceled requests do not overwrite the newest view.
- Real-device display remains to be checked. MapLibre globe and Leaflet street map still use OpenStreetMap-derived basemaps with required attribution; switching projection does not change the map's source.


## Phase 1.5 — Understand the ground and find local archives (November 2026)
The colour overlays in MapLibre Globe and Leaflet 2D now show **English SGU soil stories** when tapped. Each popup includes the English geological term, the original SGU Swedish category, the material composition, how it formed, why it matters, expandable questions and a link to SGU's source legend. For example, `Fyllning` is artificial fill placed by people; `Moränfinlera` is glacial till with more than 25% clay. These explanations describe classifications rather than asserting actual borehole material.

**Geology** under Discover now calls SGU's OGC API – Features for the map point and looks for a polygon that **contains** the selected GPS or map-center coordinate. It will not use a merely nearby polygon to label the point. A source gap is reported clearly.

**History** and **Culture** now try the official Swedish K-samsök catalogue (Riksantikvarieämbetet), instead of treating unclassified Wikipedia articles up to 10 km away as local history. The search uses a WGS84 bounding box and a strict **75 m** post-filter on source coordinates. Archival photos may be offered by their source thumbnail, with source attribution and a link to the original object. A historical image's mapped coordinate may describe the subject, not the actual photographer location. When nothing is catalogued within 75 m, the app does not invent a story; users can explicitly widen to **250 m**. **Surprise me** starts with such an archive record and falls back to a verified local SGU ground story when none is available.

Archive records and image rights remain the responsibility of the contributing institution. Descriptions may still be in the source's original Swedish: the app does not invent English translations of historical documents. The K-samsök browser API/CORS and thumbnail delivery **have not been verified on a Samsung**; on-site errors are logged in Diagnostics. No API key or GPT model is used. K-samsök documentation: https://www.raa.se/hitta-information/k-samsok/att-anvanda-k-samsok/kom-igang-med-k-samsoks-api/


## Discovery UI revision (November 2026)
- **Geology:** map popups now show English name, original Swedish name, material description and a **Read more** button. The button opens a source-linked details table *below the map* with origin, significance and expandable questions. Detailed text is no longer inside the map overlay.
- **Nature:** local iNaturalist observations select wildlife rather than raw species names only. A separate background query to Wikipedia can enrich species information; a curated Mallard profile links to an independent bird reference for food, appearance and notable facts. Images are displayed only when photo license metadata permits reuse (CC0/CC BY/CC BY-SA), with attribution.
- **Astronomy:** sunrise/sunset remain available. Astronomy Engine 2.1.19 calculates actual Moon and naked-eye planet positions for 21:00 **device-local time** from the selected coordinates entirely in the browser. No meteor shower schedule is guessed. If the optional calculator does not load, solar times still appear.
- **History:** the official K-samsök catalogue remains available for nearby records. A curated, sourced Lund hospital-district story is shown when the selected map point falls in the approximate hospital area. Hospital historical photographs are opened at the original institution website instead of republishing potentially restricted photos. This is campus context, not a claim that a specific historical photograph depicts the exact GPS point.
- **Culture:** removed because it duplicated History.

- The standalone `discovery-ui.js` renders animal diets, visual identification notes, a planet-position table and source links. If the optional astronomy library does not load, the solar-time fallback still works. The astronomy calculations run locally in the browser.


## Ask Here & Now — Mac-hosted GPT proof of concept

The public website now includes an optional **Ask Here & Now** panel under the map. Its source code remains on GitHub Pages; GPT requests go to a tiny password-protected server running on your Mac via a temporary HTTPS Cloudflare Quick Tunnel. The existing map and Discover are independent of the Mac backend.

Start with [the Mac setup guide](backend/README.md). This setup script downloads backend files into `~/HereNowBackend` and preserves private `.env` settings when updated. No Git clone or repeated git pull is required. You must create your own OpenAI API project key, install Node.js 22+ and Cloudflare Tunnel locally and keep two Terminal windows open while testing.

**Security:** Never commit or enter `OPENAI_API_KEY` in the browser. Only a separate randomly generated access token is entered in the chat settings. The server checks the token, restricts browser origins, rate-limits requests and sets `store:false` for OpenAI Responses. The frontend sends selected coordinates and geological or historical context only when you ask. API usage and optional web searches are billed separately from ChatGPT subscriptions.

**GitHub repo privacy:** GitHub Pages from a private repository requires an eligible GitHub plan, and published sites can still be publicly accessible even when the repository is private. On GitHub Free, changing the repository from public to private will unpublish Pages. We recommend leaving this prototype repository public and excluding private credentials entirely.

### Green Spaces timeout and auto-zoom fix (22 November 2026)

The first version timed out on a public Overpass API instance on Android. The layer now uses a smaller **700 m query for mapped ways**, with a sequential fallback between two public Overpass providers, aborts/timeouts, and the previous request throttling/caching. Multi-part relation-only areas may be omitted by the lightweight query; no missing data should be interpreted as absence of greenery. When **Green Spaces** is enabled on a zoomed-out globe or 2D map, it automatically zooms to level 13, like the geology toggle. The popup includes an OpenStreetMap source link and never claims public access. Green-space styling is drawn above SGU soil polygons so both toggles remain visible. Production public servers may still be busy; integration with a reliable OGC/cached data backend is a future improvement.

**Test scope:** Github Actions tests cover query shape, GeoJSON conversion, zoom helper and simulated provider failover. They do not constitute a live Samsung network test. Public Overpass instances are rate-limited shared infrastructure; the map sends coordinates to the selected provider only on user toggle, and avoids parallel provider requests.

### Green Spaces: reliable 3D globe vector tiles (November 2026)

Android reported that the two public Overpass providers repeatedly returned HTTP 502, even after reducing query size. This indicates upstream service capacity or gateway errors rather than invalid GPS data. Live Overpass requests are not suitable as the default display source for our 3D globe.

**New 3D globe behavior:** The 🌳 Green Spaces toggle uses OpenFreeMap's OSM-derived **pre-generated OpenMapTiles vector tiles** with MapLibre, rendering the `landcover` source layer for woods and grassy land and the `park` source layer for parks. No Overpass request occurs when navigating the 3D globe. Existing autozoom to zoom 13 remains. Tap an area for its mapped name/type where provided and a link to its OpenStreetMap vicinity. This is a **map visualization**, not verified walking access or a complete OSM feature registry; vector tile simplification/zoom availability and naming vary.

**2D fallback:** The separate Leaflet 2D view still uses the prior Overpass prototype for clickable individual OSM polygons. It may encounter 502/timeout errors and should later be migrated to vector tiles or a cached OGC data service too.

**Checks:** `node --test green-spaces.test.cjs green-vector.test.cjs` covers green geometry and vector style definitions. GitHub Actions also performs an external network smoke test of OpenFreeMap's public TileJSON endpoint for this PR; this test does not guarantee live Android browser rendering. The provider may change its hosting conditions. Required attribution: © OpenMapTiles © OpenStreetMap contributors.

