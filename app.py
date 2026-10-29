"""Interactive Streamlit explorer of building-to-park proximity."""
import geopandas as gpd
import folium
import streamlit as st
from streamlit_folium import st_folium
from analysis import green_space_access, summary
from download import download
from demo import demo_data

st.set_page_config(page_title="Skåne Green Access", layout="wide")
st.title("Skåne Green-Space Access Explorer")
st.caption("Exploratory geospatial analysis; NOT a heat-risk or walkability assessment.")
city = st.selectbox("Study area", ["Lund", "Malmö"])
demo_mode = st.checkbox("Offline demo (synthetic data)", value=True)
threshold = st.slider("Nearby park threshold (metres)", 100, 1000, 300, 50)

if st.button("Load / analyze data"):
    with st.spinner("Analyzing spatial features..."):
        try:
            if demo_mode:
                buildings, parks = demo_data()
            else:
                bpath, ppath = download(city)
                buildings = gpd.read_file(bpath)
                parks = gpd.read_file(ppath)
            access = green_space_access(buildings, parks, threshold)
            st.session_state["result"] = (city, threshold, access, demo_mode)
        except Exception as exc:
            st.error(f"Could not load data: {exc}")

if "result" in st.session_state:
    result_city, result_threshold, access, result_demo = st.session_state["result"]
    if result_demo:
        st.warning("SYNTHETIC DEMO: All geometries and metrics are invented test data, not measurements of Lund or Malmö.")
    metrics = summary(access)
    a, b, c = st.columns(3)
    a.metric("Mapped buildings", f'{metrics["mapped_buildings"]:,}')
    b.metric(f"Within {result_threshold} m", f'{metrics["share_within_threshold_pct"]}%')
    c.metric("Median park distance", f'{metrics["median_distance_m"]} m')
    display = access.to_crs("EPSG:4326")
    sample = display.sample(n=min(len(display), 1200), random_state=42)
    center = sample.geometry.union_all().centroid
    m = folium.Map(location=[center.y, center.x], zoom_start=12, tiles="CartoDB positron")
    for _, item in sample.iterrows():
        folium.CircleMarker(
            [item.geometry.y, item.geometry.x], radius=2,
            color="#238b45" if item["within_threshold"] else "#d94801",
            fill=True, fill_opacity=0.65, weight=0,
            tooltip=f'Park distance: {item["distance_m"]} m'
        ).add_to(m)
    st_folium(m, height=540, width=None, returned_objects=[])
    st.caption("Map samples up to 1,200 buildings for responsiveness; metrics use all analyzed buildings. © OpenStreetMap contributors for live OSM mode.")
    st.download_button(
        "Download analyzed points (GeoJSON)", data=display.to_json(),
        file_name=f'{result_city.lower()}_{"synthetic_" if result_demo else ""}park_access.geojson',
        mime="application/geo+json"
    )
