# Here & Now 🌍

**There's a story everywhere.** Here & Now is a mobile-friendly, location-aware discovery website for exploring the Earth, the ground beneath you, local history, wildlife and the sky.

**[Open the website](https://joar-rinaldo-roos.github.io/skane-green-access/)** · **Current source release: v1.0.14 (27 November 2026)**

The repository name reflects the original Skåne green-access prototype. Today's website is a broader discovery app, with a global globe and weather forecasts alongside Sweden-specific geological and heritage data.

## Explore the map

The site starts with a rotatable **MapLibre GL JS 6.16.0 globe** centered on Lund as an example, not as an inferred GPS position. OpenStreetMap raster tiles provide the basemap.

- **Find me:** request one-time browser geolocation and zoom to the selected position (zoom 15). No continuous GPS tracking.
- **Search place:** search for a Swedish place using OpenStreetMap Nominatim.
- **Map center:** explore without GPS permission or place search.
- **Soil geology:** display SGU mapped soil polygons in Sweden using its OGC API – Features. Tap a polygon for an English explanation, original Swedish classification and composition; Read more opens details beneath the map. Colours are illustrative, not the official SGU legend.

WebGL and network access are required for the globe.

**Earth / Sky:** Earth is the default; Sky is a placeholder for a future interactive planetarium. Switching back preserves the existing map. **Day & night** optionally shades the geometric night hemisphere using a local approximate solar-position calculation from the device clock, refreshed once per minute while Earth is visible. No new API, GPS, imagery or map downloads are needed. The layer sits beneath weather and geology, and uses real time rather than the forecast slider. This is not live satellite imagery, twilight or city lights.

## Weather

All four global overlays use Open-Meteo's weather-map rendering and DWD ICON Global model data.

| Control | Displays |
| --- | --- |
| 🌡️ Temp | Forecast air temperature at 2 m |
| 🌧️ Rain forecast | Predicted precipitation, including rain and snow |
| ☁️ Clouds | Total cloud cover, 0–100%; adjustable opacity (15–75%) |
| 💨 Wind | Forecast wind direction at 10 m; arrow tips point where wind is blowing |

One shared Play/Pause button and time slider synchronize enabled layers using the same model valid time. The timeline covers up to 48 hours, selecting available model frames at approximately three-hour intervals. Playback advances every 4.5 seconds and stops at the end. Cloud cover can be displayed alone or over temperature using its checkbox; wind can accompany the other layers. Weather toggles start off.

These are **model predictions**, not live radar, satellite imagery or on-site observations. Resolution, coverage, timing and accuracy depend on the upstream forecast.

### When will it rain here?

The separate Next Rain panel uses the visible map center, independently of GPS and weather-layer selection. It queries Open-Meteo hourly forecasts for the next 48 hours and combines rain and showers. A forecast hour with at least 0.2 mm counts as rain. Times are shown in the device timezone. Move the globe or use Update forecast to refresh. A prediction is not a guarantee of rain.

### Loading and performance

- Shared weather metadata loader deduplicates requests and caches metadata for up to five minutes in memory/session storage.
- Startup warming stages the four actual first-frame weather sources (native source maxzoom 12), near-transparent until enabled. The status indicates MapLibre source readiness, not that every worldwide tile has been downloaded.
- v1.0.12 allows existing preloaded sources/layers to be revealed or updated even while unrelated map style work is ongoing. Matching preloaded URLs are reused; new sources still wait for style readiness.
- One next-frame preview for one active layer is warmed at limited resolution (maxzoom 5), prioritizing clouds, rain, temperature, then wind.
- Always-on MapLibre per-source tile cache limits are 224 desktop, 128 normal mobile and 80 low-memory devices.
- Automatic weather warming is skipped on reported Data Saver and 2G-class connections. Explicit weather activation remains available. Startup staging is cancelled when a weather layer is selected.

These are best-effort optimizations, not persistent offline storage or a complete global forecast download. Actual speed and GPU/memory behaviour require device testing.

## Discover something

Choose GPS, a Swedish place or the map center, then select a topic.

| Topic | Current implementation |
| --- | --- |
| Surprise me | Nearby heritage records or curated local history; falls back to SGU geology when archives are empty/unavailable |
| History | Curated Lund hospital-district context where applicable; otherwise K-samsök geolocated records within 75 m, with an explicit option to widen to 250 m |
| Nature | iNaturalist research-grade species-count records within 5 km; wildlife details and optional Wikipedia enrichment, with permitted photo licenses and attribution |
| Astronomy | Local solar times and Astronomy Engine calculations for the Moon and naked-eye planets at 21:00 device-local time; solar-time fallback |
| Geology | SGU soil polygon containing the selected coordinate, with explanatory material and formation details; explicit coverage-gap message if no containing polygon is found |

Discoveries link to their original sources. Archive coordinates can represent the pictured subject rather than the camera position. Records may be in Swedish. Wildlife observations do not guarantee that an animal is currently present; astronomical calculations do not guarantee visibility. Geological classifications are not borehole measurements.

Culture is no longer a separate topic. The old nearby-Wikipedia-only history approach is not the current discovery flow.

## Ask Here & Now (optional GPT prototype)

The public static frontend works without GPT. The optional chat panel connects to a small Node.js server running on your Mac through a temporary Cloudflare Quick Tunnel.

Follow the **[Mac backend setup guide](backend/README.md)** for Node.js 22+, cloudflared, setup/update script, configuration and connection instructions.

- Keep the OpenAI API key in the Mac's private .env file; never place it in the frontend or GitHub.
- Enter only the tunnel HTTPS URL and separate random access token in the website.
- The URL is stored in localStorage and the token in sessionStorage.
- Questions and selected geographic/geological context are sent when Ask is pressed. The backend enforces token authentication, origin restrictions and request limits, and uses store:false for OpenAI Responses requests.
- The Mac and tunnel must remain running. Quick Tunnel addresses may change on restart. API usage is billed separately from ChatGPT subscriptions.

This is a personal prototype, not a hosted multi-user production chat service.

## Run locally

The frontend is static HTML, CSS and vanilla JavaScript. There is no frontend build step, database or required API key for the map/discoveries.

From the repository root:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000 in your browser. GPS requires browser permission and a secure context (HTTPS or localhost); a LAN HTTP URL on a phone may not permit geolocation. Internet access is required for external libraries and data.

## Repository guide

| Path | Purpose |
| --- | --- |
| index.html, style.css, map.css | Page, controls and responsive styling |
| app.js, discovery-ui.js | Location selection, discovery and result display |
| day-night.js | Earth/Sky selector and solar night shading |
| globe-loader.mjs, globe.js, globe-map-controller.js | MapLibre initialization, globe and SGU features |
| soil-info.js, archive.js, local-history.js, nature-detail.js, sky.js | Topic-specific sources and explanations |
| temperature-layer.js, rain-forecast.js, cloud-cover.js, wind-layer.js | Weather rendering, supported by corresponding core modules |
| weather-timeline.js, weather-timeline-core.js | Shared forecast clock |
| weather-data-cache.js, first-frame-preload.js, weather-prefetch.js, tile-cache.js | Weather loading and tile retention |
| next-rain.js, next-rain-core.js | Map-center precipitation forecast |
| chat.js, backend/ | Optional GPT frontend and Mac server |
| diagnostics.js | In-tab status and error reports |
| version.json | Release version and date |
| .github/workflows/ | Validation, provider smoke tests and Pages deployment |
| map.js, app.py, analysis.py, download.py, demo.py, requirements.txt | Retained older map/Python prototype; not part of the deployed frontend |

## Tests and deployment

Run the JavaScript regression suites from the repository root with a recent Node.js (22+ recommended for the backend):

```sh
node --test *.test.cjs tests/*.test.cjs backend/*.test.mjs
```

GitHub Actions runs frontend syntax checks, browser-independent regression tests, backend security/API tests and dedicated weather checks. Provider smoke tests exercise external services and may fail independently of application code.

GitHub Pages uses **Settings → Pages → Source: GitHub Actions**, not branch-root deployment. The [Pages workflow](.github/workflows/pages.yml) runs on pushes to main and manual dispatch. It validates JavaScript and relevant tests, stages only explicitly listed public frontend assets (not backend credentials or the legacy Python prototype), deploys and checks the public HTML for the expected release version, controls and script revisions.

For website releases, keep version.json and the version displayed in index.html synchronized; update version.test.cjs and deployment checks as appropriate, and review script cache-busting versions. The next application release after v1.0.14 is v1.0.15. Documentation-only edits do not require a website version bump.

Inspect [GitHub Actions](https://github.com/Joar-Rinaldo-Roos/skane-green-access/actions) and the live header to confirm deployment. A successful HTML check does not prove every external service or browser feature works.

## Privacy, sources and attribution

Location is requested on user interaction, not continuously tracked. Selected coordinates are sent to relevant external services when needed for queries; map tile requests also reveal the requested map area. The optional chat has its own data flow described above.

- Basemap and place search: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), Nominatim.
- Geological data: [SGU original soil map](https://apps.sgu.se/kartvisare/kartvisare-jordarter-25-100.html) and [OGC API – Features](https://api.sgu.se/oppnadata/jordarter25k-100k/ogc/features/v1/collections/grundlager/items).
- Weather: [Open-Meteo](https://open-meteo.com/), DWD ICON and [weather-map-layer](https://github.com/open-meteo/weather-map-layer). Review provider usage terms and library licensing.
- Heritage: [Riksantikvarieämbetet / K-samsök](https://www.raa.se/hitta-information/k-samsok/); contributing institutions retain their record/image rights.
- Nature: [iNaturalist](https://www.inaturalist.org/) and Wikipedia contributors; observe individual image/content licenses.
- Astronomy: [Astronomy Engine](https://github.com/cosinekitty/astronomy) and [Sunrise-Sunset API](https://sunrise-sunset.org/api).

Public providers may have rate limits, outages, CORS restrictions and incomplete coverage. No source is guaranteed to be available.

## Troubleshooting and validation

Open **Diagnostics & error logs**, tap Check browser, reproduce the issue and Copy error report. Reports stay in the browser tab and are intended to omit precise GPS coordinates; inspect before sharing.

If GPS is denied, use Map center or Search place. If the globe fails, check WebGL, network connectivity and browser diagnostics; check that MapLibre loads successfully. If an overlay fails, inspect its status and retry when the provider is available.

Real-device checks on Samsung/Android remain important: verify GPS grant/denial, globe rendering, SGU popups, each weather layer, first-frame reveal while other sources load, combined layers and timeline playback, Next Rain, source links and optional chat. Automated tests do not establish mobile rendering speed or live provider availability.

## Roadmap — future features

Develop Here & Now gradually, following KISS: keep each change small, test it on real devices and preserve working features. The roadmap is a living list of ideas, not a commitment to release numbers or dates.

### 🌍 Earth — a more realistic globe

Visual inspiration: [Realistic Earth globe with MapLibre](https://makewithmaplibre.com/globe/). Build on the existing MapLibre renderer rather than replacing the app.

- [x] Earth view and Day & night button.
- [x] Real-time geometric night shading, calculated locally from the device clock.
- [ ] Smooth sunlight shading and twilight — replace the abrupt dark boundary with gradual illumination based on solar elevation.
- [ ] Atmospheric glow — add a natural illuminated rim around the Earth.
- [ ] Satellite imagery at global zoom — a more realistic Earth from space, retaining the detailed street map when zooming in.
- [ ] Nighttime city lights — use suitable night-light imagery on the dark side of Earth. Historical imagery must not be presented as live lighting.

### ✨ Sky — explore the universe above you

Develop this after the Earth improvements. Keep the sky viewer tied to the selected observer location and time.

- [x] Sky button and separate view, currently a placeholder.
- [ ] Map the stars — explore different approaches to star catalogues, rendering, constellations and a location-aware night sky. Expect several small iterations rather than one large implementation.
- [ ] Mark planets at their calculated positions, with identifiable labels.
- [ ] Show satellites and their predicted positions or passes using suitable orbital data.

### 🚆 Future game — a Here & Now geography challenge

An original destination-guessing game inspired by the Swedish programme *På spåret*. Players try to identify a mystery location using progressively revealing clues. The distinctive idea is to connect the clues to what is happening **there, right now**, bringing the product's Here & Now concept into the game.

- [ ] Build the original mystery-location and clue-reveal game.
- [ ] Current local event clue: an event actually taking place at the destination now, backed by a reliable source and local time.
- [ ] Local radio clue: a song or programme actually playing on a radio station at the destination now, when verifiable current-play metadata is available.
- [ ] Add more clue types as ideas develop.

Research event feeds and radio metadata coverage, freshness, time zones, provider permissions and media rights before implementation. Do not invent live clues when data is unavailable. Keep the game's name, presentation and rules original.

## Development history

The original Skåne green-space proximity/Streamlit prototype is retained for reference; it is not integrated into Here & Now.

For detailed historical implementation notes and the v1.0.1–v1.0.12 release history, see the [previous README snapshot](https://github.com/Joar-Rinaldo-Roos/skane-green-access/blob/46c445b7995cb687d8cfe223d5d4c6e270ddf4d3/README.md). Older sections describe superseded functionality and should not be treated as current instructions.

Update this README whenever user-visible features, data sources, deployment, privacy or setup change.
