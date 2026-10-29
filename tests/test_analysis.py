import geopandas as gpd
from shapely.geometry import Point, Polygon
from analysis import green_space_access, summary
from demo import demo_data

def test_distances_in_metres():
    buildings = gpd.GeoDataFrame(geometry=[Point(0, 0), Point(500, 0)], crs="EPSG:3006")
    parks = gpd.GeoDataFrame(geometry=[Polygon([(0, -10), (10, -10), (10, 10), (0, 10)])], crs="EPSG:3006")
    result = green_space_access(buildings, parks, 300)
    assert result["within_threshold"].tolist() == [True, False]
    assert result["distance_m"].tolist() == [0, 490]
    assert summary(result)["share_within_threshold_pct"] == 50.0

def test_invalid_threshold():
    b, p = demo_data()
    try:
        green_space_access(b, p, 0)
    except ValueError:
        pass
    else:
        raise AssertionError("Expected ValueError")

def test_demo_reproducible():
    b, p = demo_data()
    first = green_space_access(b, p, 300)
    second = green_space_access(b, p, 300)
    assert len(first) == 60
    assert first["distance_m"].tolist() == second["distance_m"].tolist()
    assert 0 < summary(first)["share_within_threshold_pct"] < 100
