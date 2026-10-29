"""Download and cache OpenStreetMap building and park geometries."""
from pathlib import Path
import osmnx as ox

AREAS = {"Lund": "Lund, Skåne County, Sweden", "Malmö": "Malmö, Skåne County, Sweden"}

def download(city: str, directory: str = "data"):
    if city not in AREAS:
        raise ValueError(f"Choose one of: {list(AREAS)}")
    out = Path(directory)
    out.mkdir(parents=True, exist_ok=True)
    building_path = out / f"{city.lower()}_buildings.geojson"
    park_path = out / f"{city.lower()}_parks.geojson"
    if building_path.exists() and park_path.exists():
        return building_path, park_path
    buildings = ox.features_from_place(AREAS[city], {"building": True})
    parks = ox.features_from_place(AREAS[city], {"leisure": "park"})
    buildings = buildings[buildings.geometry.geom_type.isin(["Polygon", "MultiPolygon"])][["geometry"]].reset_index(drop=True)
    parks = parks[parks.geometry.geom_type.isin(["Polygon", "MultiPolygon"])][["geometry"]].reset_index(drop=True)
    buildings.to_file(building_path, driver="GeoJSON")
    parks.to_file(park_path, driver="GeoJSON")
    return building_path, park_path

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--city", choices=AREAS, default="Lund")
    args = parser.parse_args()
    print(download(args.city))
