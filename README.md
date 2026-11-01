# Sweden Outdoor Explorer 🌲

A **mobile-friendly outdoor discovery web app** for finding nature reserves, swimming spots and viewpoints in Sweden. Built as a personally useful GIS project with real OpenStreetMap data.

## MVP features
- Responsive layout for mobile browsers and desktop
- Interactive Leaflet map with OpenStreetMap tiles
- Search for a Swedish city (Nominatim)
- Use phone GPS location (browser permission required)
- Search nearby OpenStreetMap features using Overpass API
- Filter by nature reserves, swimming spots and viewpoints
- Show approximate straight-line distance from the search centre
- Save places locally in your browser (no account required)
- Open the original OpenStreetMap feature for more detail

## Run the web app

Open `index.html` with a local static web server:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000` on your computer. The web app has no build step.

### Put it on your phone with GitHub Pages
1. Open this repository's **Settings → Pages**.
2. Choose **Deploy from a branch**, select **main** and **/(root)**, then Save.
3. When GitHub Pages publishes the site, open its HTTPS URL on your phone.
4. Choose **Near me** and grant location access, or search for a city.

**Important:** GitHub Pages availability depends on your repository visibility and GitHub plan. If Pages is unavailable for a private repository, make a public copy of just the app files or use another static hosting provider. Do not publish private files unintentionally.

The app needs an internet connection for map tiles, geocoding and Overpass. Browser geolocation generally requires HTTPS (or localhost). Saved places persist only in the same browser/device.

## How it works
- **OpenStreetMap tiles** provide the map.
- **Nominatim** geocodes Swedish place names.
- **Overpass API** retrieves mapped nature reserves, protected areas, bathing places, beaches and viewpoints within 3, 7 or 15 km.
- Distances use the haversine formula and are **straight-line**, not walking or driving routes.
- Bookmarks are stored in browser `localStorage`, not on a server.

The app currently uses public community-operated APIs. They can be slow, rate-limited or unavailable. This MVP is appropriate for occasional personal use, not high-traffic production. Do not bulk-query or repeatedly refresh; respect provider usage policies. Results may be incomplete and not every tagged feature is a publicly accessible destination.

## Roadmap
- [ ] Validate live searches and GPS on a real phone
- [ ] Improve duplicate handling and place details
- [ ] Add hiking trails and official Swedish protected-area datasets
- [ ] Add real walking/cycling routing and estimated travel time
- [ ] Add offline-friendly caching and installable PWA support
- [ ] Add automated UI tests and deployment checks

## Previous GIS analysis
The original **Skåne Green-Space Access Explorer** Python prototype remains in `app.py`, `analysis.py`, `download.py`, `demo.py` and `tests/`. It explores building-to-park straight-line proximity with GeoPandas and Streamlit, using a synthetic offline demo or live OSM data.

Run the legacy prototype with:

```bash
pip install -r requirements.txt
python -m pytest -q
streamlit run app.py
```

The original analysis is exploratory, **not** a walkability or climate-risk model.

## Status
The static web app files have been committed to GitHub. **Live Overpass queries, hosting, mobile GPS and end-to-end behavior have not yet been verified.** The previous Python prototype's live OSM/Streamlit path also remains unverified.

Data © OpenStreetMap contributors (ODbL).
