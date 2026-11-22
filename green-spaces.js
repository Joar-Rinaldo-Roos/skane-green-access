/* Green Spaces overlay: bounded OpenStreetMap Overpass requests, Leaflet + MapLibre.
 * The layer depicts mapped green areas, not verified public access or walking routes. */
(function(){
  'use strict';
  const core=window.HereNowGreenCore;
  const button=document.getElementById('toggle-green-spaces');
  const status=document.getElementById('green-status');
  if(!core||!button||!status)return;
  const EMPTY={type:'FeatureCollection',features:[]};
  const CACHE_MS=5*60*1000, MIN_REFRESH_MS=15000, SEARCH_RADIUS=700;
  const cache=new Map();
  let enabled=false,collection=EMPTY,leafletLayer=null,requestId=0,abort=null;
  let latestKey='',lastStarted=0,timer=null;
  const log=msg=>window.HereNowDiagnostics?.log('Green spaces',msg);
  const say=msg=>{status.textContent=msg;log(msg);};
  const style=feature=>{
    const kind=feature.properties?.kind;
    return {color:'#235f42',weight:1.25,fillColor:kind==='Forest'?'#3d9b61':kind==='Park'?'#7ccb73':'#a2cf7a',fillOpacity:0.46};
  };
  function popupNode(properties) {
    const box=document.createElement('div');
    const title=document.createElement('strong');
    title.textContent=String(properties?.name||'Mapped green space');
    box.appendChild(title);
    const category=document.createElement('p');
    category.textContent=String(properties?.kind||'Green area')+' · Mapped in OpenStreetMap';
    box.appendChild(category);
    const note=document.createElement('p');
    note.textContent='Public entrance and walking accessibility have not been verified.';
    box.appendChild(note);
    const link=document.createElement('a');
    link.href=String(properties?.url||'https://www.openstreetmap.org/copyright/');
    link.textContent='View original OSM feature ↗';
    link.target='_blank';link.rel='noopener noreferrer';
    box.appendChild(link);
    return box;
  }
  function paintLeaflet(){
    const map=window.HereNowMap?.getLeafletMap?.();
    if(!map||!window.L)return;
    if(!leafletLayer){
      leafletLayer=L.geoJSON(null,{style,onEachFeature:(feature,layer)=>{
        layer.bindPopup(popupNode(feature.properties),{maxWidth:300});
      }});
    }
    leafletLayer.clearLayers();
    if(enabled&&collection.features.length)leafletLayer.addData(collection);
    if(enabled&&collection.features.length){
      if(!map.hasLayer(leafletLayer))leafletLayer.addTo(map);
    }else if(map.hasLayer(leafletLayer))map.removeLayer(leafletLayer);
  }
  // The globe reads OSM-derived VECTOR TILES instead of submitting live Overpass
  // queries on every pan. Leaflet 2D retains the optional Overpass prototype.
  let tileWatch=null,tileVerified=false;
  function paintGlobe(){
    const map=window.HereNowGlobe?.getMap?.();
    if(!map||!map.isStyleLoaded?.())return false;
    try {
      if(!map.getSource('hn-green-tiles')){
        map.addSource('hn-green-tiles',core.vectorSource());
        for(const layer of core.vectorLayers(enabled))map.addLayer(layer);
        const popupFor=event=>{
          const feature=event.features?.[0];
          if(!feature||!window.maplibregl)return;
          const detail=core.vectorDetail(feature.properties,event.lngLat.lat,event.lngLat.lng);
          const box=document.createElement('div');
          const title=document.createElement('strong');
          title.textContent=detail.name;box.appendChild(title);
          const kind=document.createElement('p');
          kind.textContent=detail.kind+' · OpenStreetMap-derived vector map';box.appendChild(kind);
          const note=document.createElement('p');note.textContent=detail.note;box.appendChild(note);
          const link=document.createElement('a');
          link.href=detail.url;link.target='_blank';link.rel='noopener noreferrer';
          link.textContent='Explore this location in OpenStreetMap ↗';
          box.appendChild(link);
          new maplibregl.Popup({maxWidth:'300px'})
            .setLngLat(event.lngLat).setDOMContent(box).addTo(map);
        };
        for(const layer of core.vectorLayers()){
          map.on('click',layer.id,popupFor);
        }
        map.on('sourcedata',event=>{
          if(event.sourceId!=='hn-green-tiles'||!event.isSourceLoaded||!enabled)return;
          tileVerified=true;
          if(tileWatch){clearTimeout(tileWatch);tileWatch=null;}
          say('Green land-cover tiles loaded. Woods, grassy areas and parks are highlighted on the 3D globe. Tap an area for more information. Public access not verified.');
        });
        map.on('error',event=>{
          const source=String(event.sourceId||'');
          const msg=String(event.error?.message||'');
          if(source==='hn-green-tiles'||msg.includes('openfreemap')){
            log('Green tile load error: '+msg.slice(0,150));
            if(enabled)say('Green map tiles could not load. Check your connection or try again later.');
          }
        });
      }
      for(const layer of core.vectorLayers(enabled)){
        if(map.getLayer(layer.id))map.setLayoutProperty(layer.id,'visibility',enabled?'visible':'none');
      }
      if(enabled && !tileVerified && !tileWatch){
        say('Loading green vector-map tiles for the current globe view…');
        tileWatch=setTimeout(()=>{
          tileWatch=null;
          if(enabled&&!tileVerified) say('Green map tiles are still loading. Check network connectivity or try the street map.');
        },16000);
      }
      if(!enabled&&tileWatch){clearTimeout(tileWatch);tileWatch=null;}
      return true;
    }catch(error){
      log('Green tile renderer failed: '+error.message);
      if(enabled)say('Green tile renderer unavailable: '+error.message);
      return false;
    }
  }
  function repaint(){paintLeaflet();paintGlobe();}
  function point(){
    const p=window.HereNowMap?.getView?.();
    if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon))return null;
    return {lat:p.lat,lon:p.lon,zoom:p.zoom??0};
  }
  function cancel(){
    requestId++;
    if(abort)abort.abort();
    abort=null;
    if(timer!==null)clearTimeout(timer);
    timer=null;
  }
  async function fetchGreenSpaces(){
    if(!enabled)return;
    // MapLibre globe uses persistent vector tiles; no Overpass call or hard radius.
    if(window.HereNowGlobe?.isActive?.()){
      if(!paintGlobe())say('The globe is still starting. Green spaces will load when ready.');
      return;
    }
    const p=point();
    if(!p){say('Map is not ready yet. Try again after it loads.');return;}
    if(p.zoom<12){say('Zoom closer, then move the map to update mapped green spaces. The layer auto-zooms when first enabled.');return;}
    const key=core.cacheKey(p);
    const found=cache.get(key);
    if(found&&Date.now()-found.when<CACHE_MS){
      latestKey=key;collection=found.data;
      repaint();
      say(collection.features.length+' mapped green areas near this view (cached). Tap a green shape for details.');
      return;
    }
    if(Date.now()-lastStarted<MIN_REFRESH_MS){
      if(timer===null){
        say('Waiting briefly before the next map request to respect public data servers…');
        timer=setTimeout(()=>{timer=null;fetchGreenSpaces();},MIN_REFRESH_MS-(Date.now()-lastStarted));
      }
      return;
    }
    cancel();
    const id=++requestId;
    latestKey=key;
    abort=new AbortController();
    const controller=abort;
    lastStarted=Date.now();
    say('Finding mapped parks and forests near the current map center…');
    try {
      const result=await core.fetchOverpass(p,{radius:SEARCH_RADIUS,signal:controller.signal});
      const data=result.data;
      log('Mapped green areas received from '+new URL(result.endpoint).hostname);
      if(id!==requestId||!enabled)return;
      const all=Array.isArray(data?.elements)?data.elements.length:0;
      collection=core.toGeoJSON(data,120);
      cache.set(key,{when:Date.now(),data:collection});
      if(cache.size>25)cache.delete(cache.keys().next().value);
      repaint();
      if(!collection.features.length) say('No closed green-area polygons found in this 700 m search. Try another location.');
      else say('Showing '+collection.features.length+' mapped green areas from OSM (700 m search'+(all>120?'; results may be incomplete':'')+'). Tap a green shape for details. Accessibility not verified.');
    }catch(error){
      if(id!==requestId||!enabled)return;
      const msg=error.name==='AbortError'?'request timed out':error.message;
      collection=EMPTY;
      repaint();
      say('Green-space data unavailable ('+msg+'). Try again later or change location.');
    }finally{if(abort===controller)abort=null;}
  }
  function scheduleRefresh(){
    if(!enabled)return;
    if(timer!==null)clearTimeout(timer);
    timer=setTimeout(()=>{timer=null;fetchGreenSpaces();},1100);
  }
  function zoomForGreenSpaces(){
    const p=point();
    if(!p)return false;
    if(p.zoom>=12)return true;
    const zoom=core.desiredZoom(p.zoom,13);
    const globe=window.HereNowGlobe;
    if(globe?.isActive?.())return Boolean(globe.zoomTo?.(zoom));
    return Boolean(window.HereNowMap?.zoomTo?.(zoom));
  }
  function toggle(){
    enabled=!enabled;
    button.classList.toggle('layer-active',enabled);
    button.setAttribute('aria-pressed',String(enabled));
    button.setAttribute('aria-label',enabled?'Hide mapped green spaces':'Show mapped green spaces');
    if(!enabled){
      cancel();collection=EMPTY;latestKey='';
      repaint();say('Green Spaces hidden. Tap the button to explore nearby mapped greenery.');
      return;
    }
    repaint();
    if(!zoomForGreenSpaces()){
      say('Opening map view… Green Spaces will load when the map is ready.');
      return;
    }
    fetchGreenSpaces();
  }
  button.addEventListener('click',toggle);
  window.HereNowGreenSpaces={scheduleRefresh,repaint,refresh:fetchGreenSpaces,isEnabled:()=>enabled,
    onMapReady:()=>{if(enabled){zoomForGreenSpaces();fetchGreenSpaces();}}};
})();
