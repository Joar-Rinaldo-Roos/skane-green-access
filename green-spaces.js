/* Green Spaces overlay: bounded OpenStreetMap Overpass requests, Leaflet + MapLibre.
 * The layer depicts mapped green areas, not verified public access or walking routes. */
(function(){
  'use strict';
  const core=window.HereNowGreenCore;
  const button=document.getElementById('toggle-green-spaces');
  const status=document.getElementById('green-status');
  if(!core||!button||!status)return;
  const URL='https://overpass-api.de/api/interpreter?data=';
  const EMPTY={type:'FeatureCollection',features:[]};
  const CACHE_MS=5*60*1000, MIN_REFRESH_MS=15000, SEARCH_RADIUS=1200;
  const cache=new Map();
  let enabled=false,collection=EMPTY,leafletLayer=null,requestId=0,abort=null;
  let latestKey='',lastStarted=0,timer=null,remaining=null;
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
  function paintGlobe(){
    const map=window.HereNowGlobe?.getMap?.();
    if(!map||!map.isStyleLoaded?.())return;
    if(!map.getSource('hn-green')){
      map.addSource('hn-green',{type:'geojson',data:collection});
      const before=map.getLayer('sgu-soil-fill')?'sgu-soil-fill':undefined;
      map.addLayer({id:'hn-green-fill',type:'fill',source:'hn-green',
        paint:{'fill-color':['match',['get','kind'],'Forest','#3d9b61','Park','#7ccb73','#a2cf7a'],'fill-opacity':0.47},
        layout:{visibility:enabled?'visible':'none'}},before);
      map.addLayer({id:'hn-green-outline',type:'line',source:'hn-green',
        paint:{'line-color':'#245f41','line-width':1.2,'line-opacity':0.9},
        layout:{visibility:enabled?'visible':'none'}},before);
      map.on('click','hn-green-fill',event=>{
        const feature=event.features?.[0];
        if(feature&&window.maplibregl){
          new maplibregl.Popup({maxWidth:'300px'}).setLngLat(event.lngLat)
            .setDOMContent(popupNode(feature.properties)).addTo(map);
        }
      });
      map.on('mouseenter','hn-green-fill',()=>{map.getCanvas().style.cursor='pointer';});
      map.on('mouseleave','hn-green-fill',()=>{map.getCanvas().style.cursor='';});
    }
    map.getSource('hn-green')?.setData(collection);
    for(const id of ['hn-green-fill','hn-green-outline']){
      if(map.getLayer(id))map.setLayoutProperty(id,'visibility',enabled?'visible':'none');
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
    const p=point();
    if(!p){say('Map is not ready yet. Try again after it loads.');return;}
    if(p.zoom<12){say('Zoom in to street level (12+) to load nearby parks and forests.');return;}
    const key=core.cacheKey(p);
    const found=cache.get(key);
    if(found&&Date.now()-found.when<CACHE_MS){
      latestKey=key;collection=found.data;
      repaint();
      say(collection.features.length+' mapped green areas near this view (cached). Tap a green shape for details.');
      return;
    }
    if(Date.now()-lastStarted<MIN_REFRESH_MS){
      if(timer===null)timer=setTimeout(()=>{timer=null;fetchGreenSpaces();},MIN_REFRESH_MS-(Date.now()-lastStarted));
      return;
    }
    cancel();
    const id=++requestId;
    latestKey=key;
    abort=new AbortController();
    const controller=abort;
    const timeout=setTimeout(()=>controller.abort(),22000);
    lastStarted=Date.now();
    say('Finding mapped parks and forests near the current map center…');
    try {
      const q=core.buildOverpassQuery(p,SEARCH_RADIUS);
      const response=await fetch(URL+encodeURIComponent(q),{signal:controller.signal,headers:{Accept:'application/json'}});
      if(!response.ok)throw Error('Overpass HTTP '+response.status);
      const data=await response.json();
      if(id!==requestId||!enabled)return;
      const all=Array.isArray(data?.elements)?data.elements.length:0;
      collection=core.toGeoJSON(data,120);
      cache.set(key,{when:Date.now(),data:collection});
      if(cache.size>25)cache.delete(cache.keys().next().value);
      repaint();
      if(!collection.features.length) say('No closed green-area polygons found in this 1.2 km search. Try another location.');
      else say('Showing '+collection.features.length+' mapped green areas from OSM (1.2 km search'+(all>120?'; results may be incomplete':'')+'). Tap a green shape for details. Accessibility not verified.');
    }catch(error){
      if(id!==requestId||!enabled)return;
      const msg=error.name==='AbortError'?'request timed out':error.message;
      collection=EMPTY;
      repaint();
      say('Green-space data unavailable ('+msg+'). Try again later or change location.');
    }finally{clearTimeout(timeout);if(abort===controller)abort=null;}
  }
  function scheduleRefresh(){
    if(!enabled)return;
    if(timer!==null)clearTimeout(timer);
    timer=setTimeout(()=>{timer=null;fetchGreenSpaces();},1100);
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
    fetchGreenSpaces();
  }
  button.addEventListener('click',toggle);
  window.HereNowGreenSpaces={scheduleRefresh,repaint,refresh:fetchGreenSpaces,isEnabled:()=>enabled};
})();
