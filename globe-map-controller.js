/* Here & Now v1.0.8 — lightweight globe-only location and SGU geology controller.
 * No Leaflet, duplicate OSM tile renderer, or hidden 2D canvas.
 * Exposes the existing HereNowMap API for search, GPS, soil, chat,
 * local discovery and the Next Rain prediction at the active globe center. */
(function(){
  'use strict';
  const status=document.getElementById('map-status');
  const button=document.getElementById('toggle-geology');
  const API='https://api.sgu.se/oppnadata/jordarter25k-100k/ogc/features/v1/collections/grundlager/items';
  const COLORS=['#c28b5f','#71976d','#bfa64d','#9a8aaa','#d28c84','#78a9b5','#bb855e','#8eae78','#b6a5cf'];
  const MAX_FEATURES=180;
  const HOME={lat:55.7047,lon:13.1910,zoom:3.3};
  const EMPTY={type:'FeatureCollection',features:[]};
  let selected=null,selectedZoom=14,viewProvider=null,geologyObserver=null;
  let geologyVisible=false,collection=EMPTY,requestId=0,abort=null,timer=null;
  const log=msg=>window.HereNowDiagnostics?.log('SGU OGC Features',msg);
  const setStatus=msg=>{if(status)status.textContent=msg;};
  function colorFor(value){
    let hash=0;
    for(const char of String(value||'Other'))hash=((hash*31)+char.charCodeAt(0))|0;
    return COLORS[(hash>>>0)%COLORS.length];
  }
  function notify(event){
    try{geologyObserver?.(event);}catch(error){log('Globe geology observer failed: '+error.message);}
  }
  function subscribeGeology(listener){
    geologyObserver=listener;
    notify({type:'data',collection,enabled:geologyVisible});
  }
  function setViewProvider(fn){viewProvider=fn;}
  function globeView(){return viewProvider?.()||null;}
  function getView(){
    const view=globeView();
    if(view?.center)return {...view.center,zoom:view.zoom};
    return selected?{lat:selected.lat,lon:selected.lon,zoom:selectedZoom}:HOME;
  }
  function insideRing(point,ring){
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const a=ring[i],b=ring[j];
      if(((a[1]>point[1])!==(b[1]>point[1])) &&
         point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    return inside;
  }
  function insidePolygon(point,rings){
    return Array.isArray(rings)&&rings.length>0&&insideRing(point,rings[0])&&
      !rings.slice(1).some(r=>insideRing(point,r));
  }
  function containsPoint(feature,point){
    const geom=feature?.geometry;
    return geom?.type==='Polygon'?insidePolygon(point,geom.coordinates):
      geom?.type==='MultiPolygon'&&geom.coordinates.some(r=>insidePolygon(point,r));
  }
  function getSoilAt(place){
    if(!Number.isFinite(place?.lat)||!Number.isFinite(place?.lon))return null;
    return collection.features.find(feature=>containsPoint(feature,[place.lon,place.lat]))||null;
  }
  async function lookupSoilAt(place){
    const cached=getSoilAt(place);
    if(cached)return cached;
    if(!Number.isFinite(place?.lat)||!Number.isFinite(place?.lon))return null;
    const r=0.00015,bbox=[place.lon-r,place.lat-r,place.lon+r,place.lat+r].map(x=>x.toFixed(6)).join(',');
    const params=new URLSearchParams({bbox,limit:'100',f:'application/geo+json'});
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),13000);
    try{
      const res=await fetch(API+'?'+params,{headers:{Accept:'application/geo+json, application/json'},signal:controller.signal});
      if(!res.ok)throw Error('SGU HTTP '+res.status);
      const data=await res.json();
      if(!Array.isArray(data.features))throw Error('Invalid SGU response');
      return data.features.find(f=>containsPoint(f,[place.lon,place.lat]))||null;
    }finally{clearTimeout(timeout);}
  }
  function cancel(){
    if(timer!==null)clearTimeout(timer);timer=null;
    if(abort)abort.abort();abort=null;
  }
  function hideGeology(){
    geologyVisible=false;requestId++;cancel();
    button?.classList.remove('layer-active');
    button?.setAttribute('aria-pressed','false');
    notify({type:'visibility',enabled:false});
    setStatus('Soil geology hidden. Explore the 3D globe.');
  }
  async function fetchSoilFeatures(){
    if(!geologyVisible)return;
    const view=globeView();
    if(!view?.bounds||!Number.isFinite(view.zoom))return;
    if(view.zoom<11){
      collection=EMPTY;
      notify({type:'data',collection,enabled:true});
      setStatus('Zoom closer (level 11+) to show detailed SGU geological areas.');
      return;
    }
    const b=view.bounds;
    const coords=[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];
    if(!coords.every(Number.isFinite))return;
    const id=++requestId;cancel();
    const bbox=coords.map(x=>x.toFixed(5)).join(',');
    const params=new URLSearchParams({bbox,limit:String(MAX_FEATURES),f:'application/geo+json'});
    const controller=new AbortController();abort=controller;
    const timeout=setTimeout(()=>controller.abort(),20000);
    setStatus('Loading mapped soil polygons from SGU…');
    try{
      const res=await fetch(API+'?'+params,{headers:{Accept:'application/geo+json, application/json'},signal:controller.signal});
      if(!res.ok)throw Error('SGU HTTP '+res.status);
      const data=await res.json();
      if(id!==requestId||!geologyVisible)return;
      if(data.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('Invalid SGU GeoJSON');
      const drawable=data.features.filter(f=>
        (f?.geometry?.type==='Polygon'||f?.geometry?.type==='MultiPolygon')&&
        Array.isArray(f.geometry.coordinates));
      collection={type:'FeatureCollection',features:drawable.map(f=>({
        ...f,properties:{...f.properties,_hereNowColor:colorFor(f.properties?.jg2_tx||f.properties?.jg2)}
      }))};
      notify({type:'data',collection,enabled:true});
      setStatus(!collection.features.length?'No mapped SGU soil polygons here.':
        'Showing '+collection.features.length+' SGU mapped soil polygons. Tap an area to identify it.');
    }catch(error){
      if(id!==requestId||!geologyVisible)return;
      log('SGU geology failed: '+String(error?.message||error));
      collection=EMPTY;notify({type:'data',collection,enabled:true});
      setStatus('SGU geology unavailable. Check your connection or open the official SGU map.');
    }finally{clearTimeout(timeout);if(abort===controller)abort=null;}
  }
  function scheduleGeologyRefresh(){
    if(!geologyVisible)return;
    if(timer!==null)clearTimeout(timer);
    timer=setTimeout(fetchSoilFeatures,800);
  }
  function showGeology(on){
    if(!on){hideGeology();return;}
    geologyVisible=true;
    button?.classList.add('layer-active');
    button?.setAttribute('aria-pressed','true');
    notify({type:'visibility',enabled:true});
    const view=globeView();
    if(view?.zoom<11)window.HereNowGlobe?.zoomTo?.(12);
    scheduleGeologyRefresh();
  }
  function setLocation(place,options={}){
    if(!Number.isFinite(place?.lat)||!Number.isFinite(place?.lon))return;
    selected=place;selectedZoom=options.zoom||14;
    setStatus('Selected '+(place.name||'location')+'. Exploring on the 3D globe.');
    if(geologyVisible)scheduleGeologyRefresh();
  }
  function clearLocation(){selected=null;setStatus('Explore the globe or choose another location.');}
  function zoomTo(zoom=13){return Boolean(window.HereNowGlobe?.zoomTo?.(zoom));}
  button?.addEventListener('click',()=>showGeology(!geologyVisible));
  window.HereNowMap={
    setLocation,clearLocation,showGeology,setStatus,getView,resize:()=>{},
    setViewProvider,subscribeGeology,isGeologyEnabled:()=>geologyVisible,
    scheduleGeologyRefresh,getSoilAt,lookupSoilAt,getLeafletMap:()=>null,zoomTo
  };
  setStatus('3D globe starts near Lund. Rotate, zoom or search for another place.');
})();
