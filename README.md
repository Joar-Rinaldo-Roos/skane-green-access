# Skåne Green-Space Access Explorer

An exploratory GIS portfolio project analyzing **straight-line proximity of mapped buildings to parks** in Lund and Malmö, Sweden. Built for sustainable urban planning and reproducible spatial analysis.

**Important:** Proximity to a mapped park is not a climate-risk score, walkability measure, or population-access measure. Buildings are not weighted by residents, park entrances are not modeled, and OpenStreetMap may be incomplete.

## Features
- Query and cache OpenStreetMap building footprints and park polygons via OSMnx
- Reproject geometries to **SWEREF99 TM (EPSG:3006)** for metre-based spatial analysis
- Compute distances from building representative points to park polygons
- Explore 100–1000 m thresholds and export results as GeoJSON
- Interactive Folium map in Streamlit, with reproducible marker sampling
- **Offline synthetic demo** for testing without network access; clearly labeled as fictional
- Unit tests for distance calculations and reproducibility

## Run locally

Requires Python 3.11+.

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
python -m pytest -q
streamlit run app.py
```

The app defaults to **synthetic demo mode**. Uncheck the demo box and select Lund or Malmö to query real OSM data. Large Overpass queries can be slow or fail; downloaded GeoJSON files are cached under `data/` and excluded from Git.

## Data and methods
- **Source:** © OpenStreetMap contributors, via OSMnx / Overpass. Respect OSM attribution and ODbL terms.
- **Input geometries:** OSM `building=*` footprints and `leisure=park` polygons.
- **CRS:** EPSG:3006 for distances; EPSG:4326 for map display and GeoJSON export.
- **Indicator:** Euclidean distance from each building's representative point to the nearest park polygon; a threshold flags proximity.
- **Caveats:** No street-network routing, entrances, demographic weighting, vegetation cover, accessibility, or causal climate inference. Park tags are incomplete and do not capture all green space.
- **Reproducibility:** Live OSM results vary with updates; cached GeoJSON preserves a local snapshot. Tests use fixed synthetic geometries.

## Next steps
Add walking-network access, neighborhood-level aggregation, and provenance metadata for a fixed OSM extract. These are ideas, not implemented features.

## Status
Spatial core tested locally (3 tests passed). The live OSM download and full Streamlit deployment have **not yet been validated end-to-end**.
