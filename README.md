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
