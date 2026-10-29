"""Green-space proximity indicators (not a climate-risk or walkability model)."""
import geopandas as gpd

CRS = "EPSG:3006"  # SWEREF99 TM; metres

def green_space_access(buildings: gpd.GeoDataFrame, parks: gpd.GeoDataFrame, threshold_m: float = 300) -> gpd.GeoDataFrame:
    """Straight-line distance from building representative points to mapped park polygons."""
    if threshold_m <= 0:
        raise ValueError("threshold_m must be positive")
    if buildings.crs is None or parks.crs is None:
        raise ValueError("Both layers require a CRS")
    if buildings.empty or parks.empty:
        raise ValueError("Both layers must contain features")
    b = buildings.to_crs(CRS).copy()
    p = parks.to_crs(CRS).copy()
    b = b[b.geometry.notna() & ~b.geometry.is_empty]
    p = p[p.geometry.notna() & ~p.geometry.is_empty]
    if b.empty or p.empty:
        raise ValueError("No valid geometries")
    b["geometry"] = b.geometry.representative_point()
    park_union = p.geometry.union_all()
    b["distance_m"] = b.geometry.distance(park_union).round(1)
    b["within_threshold"] = b["distance_m"] <= threshold_m
    return b

def summary(access: gpd.GeoDataFrame) -> dict:
    return {
        "mapped_buildings": int(len(access)),
        "share_within_threshold_pct": round(float(access["within_threshold"].mean() * 100), 1),
        "median_distance_m": round(float(access["distance_m"].median()), 1),
    }
