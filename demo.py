"""Deterministic synthetic geodata for offline demos; NOT real Swedish measurements."""
import geopandas as gpd
from shapely.geometry import Point

def demo_data():
    # Coordinates are near Lund in EPSG:3006; every feature is synthetic.
    x, y = 385000, 6175000
    buildings = gpd.GeoDataFrame(
        {"building_id": [f"demo-{i}" for i in range(60)]},
        geometry=[Point(x + (i % 10) * 95, y + (i // 10) * 110).buffer(12)
                  for i in range(60)], crs="EPSG:3006")
    parks = gpd.GeoDataFrame(
        {"park_id": ["synthetic-west", "synthetic-east"]},
        geometry=[Point(x + 150, y + 200).buffer(105),
                  Point(x + 750, y + 430).buffer(95)], crs="EPSG:3006")
    return buildings, parks
