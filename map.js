/* Here & Now: mobile Leaflet map + real SGU OGC API Features polygons.
 * SGU's legacy WMS image requests failed on-device; this uses queryable GeoJSON instead.
 * A working API response is required. No local geology is fabricated. */
(function () {
  'use strict';
  const statusEl = document.getElementById('map-status');
  const geologyButton = document.getElementById('toggle-geology');
  const locateButton = document.getElementById('locate');
  const API = 'https://api.sgu.se/oppnadata/jordarter25k-100k/ogc/features/v1/collections/grundlager/items';
  const MAX_FEATURES = 180;
  const COLORS = ['#c28b5f','#71976d','#bfa64d','#9a8aaa','#d28c84','#78a9b5','#bb855e','#8eae78','#b6a5cf'];
  let map, marker = null, accuracyCircle = null, geologyLayer = null;
  let geologyVisible = false, geologyRequest = 0, abortRequest = null;
  let refreshTimer = null;
  let viewProvider = null;
  let geologyObserver = null;
  let lastCollection = { type:'FeatureCollection', features:[] };
  let lastSelectedPoint = null;
  let lastSelectedZoom = 14;

  function notifyGeology(message) {
    if (geologyObserver) {
      try { geologyObserver(message); }
      catch (error) { log('Overlay renderer failed: ' + error.message); }
    }
  }
  function subscribeGeology(listener) {
    geologyObserver = listener;
    listener({ type:'data', collection:lastCollection, enabled:geologyVisible });
  }
  function setViewProvider(provider) { viewProvider = provider; }
  function activeView() {
    const other = viewProvider?.();
    if (other && other.bounds && Number.isFinite(other.zoom)) return other;
    return map ? { bounds:map.getBounds(), zoom:map.getZoom() } : null;
  }
  function isGeologyEnabled() { return geologyVisible; }

  function firstCoordinate(geometry) {
    let point = geometry?.coordinates;
    while (Array.isArray(point) && Array.isArray(point[0])) point = point[0];
    return Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]) ? point : null;
  }

  function log(message) { window.HereNowDiagnostics?.log('SGU OGC Features',message); }
  function setStatus(message) { statusEl.textContent = message; }

  function colorFor(value) {
    let hash = 0;
    const str = String(value || 'Other');
    for (let i=0;i<str.length;i++) hash = ((hash * 31) + str.charCodeAt(i)) | 0;
    return COLORS[(hash >>> 0) % COLORS.length];
  }

  function popup(feature, layer) {
    const raw = feature.properties?.jg2_tx || feature.properties?.jg2 || 'Unclassified';
    const content = window.HereNowSoil?.createSummary(raw) || document.createTextNode(String(raw));
    layer.bindPopup(content,{maxWidth:310,minWidth:245});
  }

  // Point-in-polygon is used only for a feature that actually covers the selected point.
  // An archive or geology record elsewhere in the search bbox is not treated as underfoot.
  function insideRing(point, ring) {
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const a=ring[i],b=ring[j];
      if(((a[1]>point[1])!==(b[1]>point[1])) &&
         (point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]))inside=!inside;
    }
    return inside;
  }
  function insidePolygon(point, rings) {
    return Array.isArray(rings)&&rings.length>0 && insideRing(point,rings[0]) &&
      !rings.slice(1).some(ring=>insideRing(point,ring));
  }
  function containsPoint(feature, point) {
    const geom=feature?.geometry;
    if(geom?.type==='Polygon')return insidePolygon(point,geom.coordinates);
    if(geom?.type==='MultiPolygon')return geom.coordinates.some(rings=>insidePolygon(point,rings));
    return false;
  }
  function getSoilAt(place) {
    if(!Number.isFinite(place?.lat)||!Number.isFinite(place?.lon))return null;
    return lastCollection.features.find(f=>containsPoint(f,[place.lon,place.lat]))||null;
  }
  async function lookupSoilAt(place) {
    const cached=getSoilAt(place);
    if(cached)return cached;
    if(!Number.isFinite(place?.lat)||!Number.isFinite(place?.lon))return null;
    const r=0.00015;
    const bbox=[place.lon-r,place.lat-r,place.lon+r,place.lat+r].map(n=>n.toFixed(6)).join(',');
    const params=new URLSearchParams({bbox,limit:'100',f:'application/geo+json'});
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),13000);
    try{
      log('Checking mapped soil at selected point (coordinates omitted)');
      const response=await fetch(API+'?'+params,{headers:{Accept:'application/geo+json, application/json'},signal:controller.signal});
      if(!response.ok)throw Error('SGU HTTP '+response.status);
      const data=await response.json();
      if(!Array.isArray(data.features))throw Error('SGU returned invalid feature data');
      const covering=data.features.find(f=>containsPoint(f,[place.lon,place.lat]))||null;
      log(covering?'SGU polygon contains selected point':'No SGU polygon contains selected point');
      return covering;
    }catch(error){
      log('Point geology lookup failed: '+error.message);
      throw error;
    }finally{clearTimeout(timer);}
  }

  function cancelQuery() {
    if (refreshTimer !== null) clearTimeout(refreshTimer);
    refreshTimer = null;
    if (abortRequest) abortRequest.abort();
    abortRequest = null;
  }

  function hideLayer() {
    geologyVisible = false;
    geologyRequest++;
    cancelQuery();
    if (geologyLayer && map && map.hasLayer(geologyLayer)) map.removeLayer(geologyLayer);
    notifyGeology({ type:'visibility', enabled:false });
    geologyButton.classList.remove('layer-active');
    geologyButton.setAttribute('aria-pressed','false');
    geologyButton.setAttribute('aria-label','Show SGU soil geology features');
    setStatus('Street map showing. SGU soil geology hidden.');
  }

  async function fetchSoilFeatures() {
    if (!map || !geologyVisible) return;
    const id = ++geologyRequest;
    cancelQuery();
    const view = activeView();
    if (!view) return;
    const z = view.zoom;
    if (z < 11) {
      if (geologyLayer && map.hasLayer(geologyLayer)) map.removeLayer(geologyLayer);
      setStatus('Zoom closer (zoom level 11+) to load detailed SGU geological features.');
      notifyGeology({type:'data', collection:{type:'FeatureCollection',features:[]}, enabled:true});
      return;
    }
    const b = view.bounds;
    const coords = [b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];
    if (!coords.every(Number.isFinite)) return;
    // SGU OGC API Features uses CRS84 bbox longitude/latitude; does not use Leaflet's EPSG:3857.
    const bbox = coords.map(x=>x.toFixed(5)).join(',');
    const params = new URLSearchParams({ bbox, limit: String(MAX_FEATURES), f:'application/geo+json' });
    const url = API + '?' + params.toString();
    abortRequest = new AbortController();
    const signal = abortRequest.signal;
    const timeout = setTimeout(()=>abortRequest?.abort(), 20000);
    setStatus('Loading mapped soil polygons from SGU’s OGC Features API…');
    log('Request started (bbox hidden for location privacy)');
    try {
      const response = await fetch(url, { headers: { 'Accept': 'application/geo+json, application/json' }, signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (id !== geologyRequest || !geologyVisible) return;
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Invalid GeoJSON response');
      const drawable = data.features.filter(f=>
        (f?.geometry?.type==='Polygon' || f?.geometry?.type==='MultiPolygon')
        && firstCoordinate(f.geometry));
      const features = drawable.filter(f=>{
        const point = firstCoordinate(f.geometry);
        return point[0] >= -180 && point[0] <= 180 && point[1] >= -90 && point[1] <= 90;
      }).map(f=>({
        ...f,
        properties:{...f.properties,_hereNowColor:colorFor(f.properties?.jg2_tx||f.properties?.jg2)}
      }));
      log('Returned '+data.features.length+' features; '+features.length+' drawable WGS84 polygons');
      if (data.features.length && !features.length) {
        throw new Error('SGU features have no usable WGS84 polygon coordinates');
      }
      if (!geologyLayer) {
        geologyLayer = L.geoJSON(null, {
          style: f=>({
            color:'#5b5747', weight:0.65,
            fillColor:colorFor(f.properties?.jg2_tx || f.properties?.jg2),
            fillOpacity:0.55
          }),
          onEachFeature: popup
        });
      }
      geologyLayer.clearLayers();
      if (features.length) geologyLayer.addData({type:'FeatureCollection',features});
      if (!map.hasLayer(geologyLayer)) geologyLayer.addTo(map);
      lastCollection = {type:'FeatureCollection',features};
      notifyGeology({type:'data',collection:lastCollection,enabled:true});
      log('Received '+features.length+' drawable soil polygons (HTTP '+response.status+')');
      if (!features.length) {
        setStatus('SGU returned no mapped soil polygons for this view. Pan or zoom, or check the official SGU map.');
      } else if (features.length >= MAX_FEATURES || data.links?.some(link=>link.rel==='next')) {
        setStatus('Showing ' + features.length + ' SGU soil polygons (partial result). Zoom closer for more detail. Tap a coloured area for its name.');
      } else {
        setStatus('Showing ' + features.length + ' SGU soil polygons. Tap a coloured area to see the recorded soil type.');
      }
    } catch (error) {
      if (id !== geologyRequest || !geologyVisible) return;
      const message = error.name === 'AbortError' ? 'Request timed out' : error.message;
      log('Geology request failed: ' + message);
      setStatus('SGU geological features unavailable (' + message + '). Try again or open SGU’s original map below.');
      if (geologyLayer && map.hasLayer(geologyLayer)) map.removeLayer(geologyLayer);
      notifyGeology({type:'data',collection:{type:'FeatureCollection',features:[]},enabled:true});
    } finally {
      clearTimeout(timeout);
    }
  }

  function scheduleRefresh() {
    if (!geologyVisible) return;
    if (refreshTimer !== null) clearTimeout(refreshTimer);
    refreshTimer=setTimeout(fetchSoilFeatures, 800);
  }

  function showGeology(enabled) {
    if (!map) {
      setStatus('The map is not ready. Reload the page to try again.');
      return;
    }
    if (!enabled) { hideLayer(); return; }
    if (geologyVisible) { scheduleRefresh(); return; }
    geologyVisible=true;
    geologyButton.classList.add('layer-active');
    geologyButton.setAttribute('aria-pressed','true');
    geologyButton.setAttribute('aria-label','Hide SGU soil geology features');
    notifyGeology({type:'visibility',enabled:true});
    fetchSoilFeatures();
  }

  function setLocation(place, options={}) {
    if (!map || !Number.isFinite(place?.lat) || !Number.isFinite(place?.lon)) return;
    const point=[place.lat,place.lon];
    if (marker) map.removeLayer(marker);
    if (accuracyCircle) map.removeLayer(accuracyCircle);
    marker=L.circleMarker(point, {radius:9,weight:3,color:'#fff',fillColor:'#176b50',fillOpacity:1}).addTo(map);
    const popupText=document.createElement('span');
    popupText.textContent=place.name||'Selected location';
    marker.bindPopup(popupText);
    accuracyCircle=null;
    if (Number.isFinite(place.accuracy) && place.accuracy>0 && place.accuracy<10000) {
      accuracyCircle=L.circle(point,{radius:place.accuracy,color:'#176b50',fillColor:'#176b50',fillOpacity:0.08,weight:1}).addTo(map);
    }
    lastSelectedPoint = point;
    lastSelectedZoom = options.zoom || 14;
    // Leaflet does not calculate tile dimensions correctly while hidden behind Globe.
    if (!document.getElementById('map')?.hidden) {
      map.setView(point,lastSelectedZoom,{animate:false});
    }
    setStatus('Showing '+(place.name||'selected location')+'. Pan and zoom to explore.');
    if (geologyVisible) scheduleRefresh();
  }

  function clearLocation() {
    if (!map) return;
    if (marker) map.removeLayer(marker);
    if (accuracyCircle) map.removeLayer(accuracyCircle);
    marker=null;accuracyCircle=null;
    lastSelectedPoint=null;
    setStatus('Choose a place or tap Find me to mark a location.');
  }

  function getView() {
    if (!map) return null;
    const view = viewProvider?.();
    if (view?.center) return {...view.center,zoom:view.zoom};
    const p=map.getCenter();
    return {lat:p.lat,lon:p.lng,zoom:map.getZoom()};
  }
  function resize() {
    if (!map) return;
    setTimeout(()=>{
      if (document.getElementById('map')?.hidden) return;
      map.invalidateSize({pan:false});
      if (lastSelectedPoint) map.setView(lastSelectedPoint,lastSelectedZoom,{animate:false});
      map.invalidateSize({pan:false});
      if (geologyVisible) scheduleRefresh();
    },110);
  }
  window.HereNowMap={setLocation,clearLocation,showGeology,setStatus,getView,resize,setViewProvider,subscribeGeology,isGeologyEnabled,scheduleGeologyRefresh:scheduleRefresh,getSoilAt,lookupSoilAt};

  if (!window.L) {
    geologyButton.disabled=true;
    setStatus('Leaflet could not load. Other discovery features can still work.');
    return;
  }

  try {
    map=L.map('map',{zoomControl:false,scrollWheelZoom:false}).setView([55.7047,13.1910],13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    L.control.zoom({position:'bottomright'}).addTo(map);
    L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
    map.on('moveend',()=>{if (!document.getElementById('map')?.hidden) scheduleRefresh();});
    geologyButton.addEventListener('click',()=>showGeology(!geologyVisible));
  } catch (error) {
    geologyButton.disabled=true;
    locateButton.disabled=false;
    setStatus('Unable to initialize the map. Discovery can still be used.');
    log('Map setup failed: '+error.message);
  }
})();
