/* Globe-first MapLibre projection, synchronized with Leaflet and SGU OGC Features.
 * Only the map basemap uses OSM; coloured polygons come directly from SGU. */
(function () {
  'use strict';
  const button=document.getElementById('toggle-globe');
  const street=document.getElementById('map');
  const globeContainer=document.getElementById('globe-map');
  const controller=window.HereNowMap;
  if (!button || !street || !globeContainer || !controller) return;

  const EMPTY={type:'FeatureCollection',features:[]};
  let globeMap=null, globeReady=false, globeActive=false, globeMarker=null;
  let currentPlace=null, lastZoom=15, soilCollection=EMPTY, geologyEnabled=false;
  const diag=(message)=>window.HereNowDiagnostics?.log('Globe',message);

  function setViewFromPlace(place,zoom) {
    if (!globeMap || !globeReady || !place) return;
    // Unlike the old hard-coded zoom 4, respect the GPS or place-search zoom.
    globeMap.jumpTo({center:[place.lon,place.lat],zoom:Math.max(3,Math.min(16,zoom||15))});
  }
  function syncMarker() {
    if (!globeMap || !globeReady || !window.maplibregl) return;
    if (globeMarker) globeMarker.remove();
    globeMarker=null;
    if (currentPlace) {
      const dot=document.createElement('div');
      dot.className='globe-marker';
      dot.setAttribute('aria-label',currentPlace.name||'Selected place');
      globeMarker=new maplibregl.Marker({element:dot})
        .setLngLat([currentPlace.lon,currentPlace.lat]).addTo(globeMap);
    }
  }
  function ensureSoilLayers() {
    if (!globeMap || !globeReady || globeMap.getSource('sgu-geology')) return;
    globeMap.addSource('sgu-geology',{type:'geojson',data:soilCollection});
    globeMap.addLayer({
      id:'sgu-soil-fill',type:'fill',source:'sgu-geology',
      paint:{'fill-color':['coalesce',['get','_hereNowColor'],'#b88d67'],'fill-opacity':0.62},
      layout:{visibility:geologyEnabled?'visible':'none'}
    });
    globeMap.addLayer({
      id:'sgu-soil-outline',type:'line',source:'sgu-geology',
      paint:{'line-color':'#294a39','line-opacity':0.86,'line-width':1},
      layout:{visibility:geologyEnabled?'visible':'none'}
    });
    globeMap.on('click','sgu-soil-fill',event=>{
      const feature=event.features?.[0];
      if (!feature) return;
      const card=document.createElement('div');
      const label=document.createElement('strong');
      label.textContent=feature.properties?.jg2_tx || 'Unclassified mapped soil';
      const note=document.createElement('p');
      note.textContent='SGU mapped soil; not a ground investigation at this precise point.';
      card.appendChild(label);card.appendChild(note);
      new maplibregl.Popup().setLngLat(event.lngLat).setDOMContent(card).addTo(globeMap);
    });
  }
  function paintSoil() {
    if (!globeMap || !globeReady) return;
    ensureSoilLayers();
    const source=globeMap.getSource('sgu-geology');
    if (source) source.setData(soilCollection);
    globeMap.setLayoutProperty('sgu-soil-fill','visibility',geologyEnabled?'visible':'none');
    globeMap.setLayoutProperty('sgu-soil-outline','visibility',geologyEnabled?'visible':'none');
  }

  function toStreet() {
    globeActive=false;
    globeContainer.hidden=true;
    street.hidden=false;
    button.textContent='🌐 Globe';
    button.setAttribute('aria-pressed','false');
    button.setAttribute('aria-label','Switch to 3D globe');
    controller.resize?.();
    controller.setStatus('2D street map active. Soil geology remains available.');
  }
  function failGlobe(message) {
    diag(message);
    if (globeMap) {try {globeMap.remove();}catch (_){} globeMap=null;}
    globeReady=false;
    toStreet();
    controller.setStatus(message);
  }
  function toGlobe() {
    if (!window.maplibregl) {
      const state=window.HereNowGlobeLoader?.state;
      controller.setStatus(state==='error'?'Globe library failed to load. Check diagnostics.':'Globe library is loading. Try again shortly.');
      return;
    }
    if (typeof maplibregl.supported==='function' && !maplibregl.supported()) {
      controller.setStatus('WebGL is not available in this browser. The 2D street map is available.');
      diag('WebGL unsupported');return;
    }
    globeActive=true;
    globeContainer.hidden=false;
    street.hidden=true;
    button.textContent='🗺️ 2D map';
    button.setAttribute('aria-pressed','true');
    button.setAttribute('aria-label','Switch to 2D street map');
    controller.setStatus('3D globe active. Drag to rotate; pinch to zoom.');
    if (globeMap) {
      globeMap.resize();
      if (currentPlace) setViewFromPlace(currentPlace,lastZoom);
      controller.scheduleGeologyRefresh?.();
      return;
    }
    const local=controller.getView?.() || {lat:55.7047,lon:13.1910};
    try {
      globeMap=new maplibregl.Map({
        container:'globe-map',
        style:{
          version:8,
          sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize:256,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}},
          layers:[{id:'osm',type:'raster',source:'osm'}]
        },
        center:currentPlace?[currentPlace.lon,currentPlace.lat]:[local.lon,local.lat],
        zoom:currentPlace?lastZoom:3.3,
        minZoom:0.5,maxZoom:18,
        attributionControl:true
      });
      globeMap.on('style.load',()=>globeMap.setProjection({type:'globe'}));
      globeMap.on('load',()=>{
        globeReady=true;
        syncMarker();
        paintSoil();
        if(currentPlace) setViewFromPlace(currentPlace,lastZoom);
        controller.scheduleGeologyRefresh?.();
        if(globeActive)controller.setStatus('Globe ready. Find me zooms to your GPS location; Soil geology adds SGU polygons.');
      });
      globeMap.on('moveend',()=>{if(globeActive)controller.scheduleGeologyRefresh?.();});
      globeMap.on('error',event=>{diag('MapLibre resource/render error; globe may be partially available');});
    } catch(error) {
      failGlobe('The 3D globe could not start. The 2D map remains available.');
    }
  }
  button.addEventListener('click',()=>{if(globeActive)toStreet();else toGlobe();});

  // The active map's viewport, not the hidden Leaflet viewport, drives SGU queries.
  controller.setViewProvider?.(()=>{
    if(!globeActive||!globeMap||!globeReady)return null;
    const p=globeMap.getCenter();
    return {bounds:globeMap.getBounds(),zoom:globeMap.getZoom(),center:{lat:p.lat,lon:p.lng}};
  });
  controller.subscribeGeology?.(event=>{
    if(event.type==='data'){soilCollection=event.collection||EMPTY;geologyEnabled=!!event.enabled;}
    else if(event.type==='visibility') geologyEnabled=!!event.enabled;
    paintSoil();
    if(event.type==='visibility' && geologyEnabled && globeActive && globeMap && globeReady && globeMap.getZoom()<11) {
      const center=currentPlace?[currentPlace.lon,currentPlace.lat]:[13.1910,55.7047];
      globeMap.jumpTo({center,zoom:12});
    }
  });
  const priorLocation=controller.setLocation;
  controller.setLocation=function(place,options) {
    priorLocation(place,options);
    if(!place || !Number.isFinite(place.lat)||!Number.isFinite(place.lon))return;
    currentPlace=place;
    lastZoom=options?.zoom||15;
    syncMarker();
    if(globeMap && globeActive) {
      if(globeReady) setViewFromPlace(place,lastZoom);
      controller.setStatus('Centered on '+(place.name||'selected location')+'. Zoom '+lastZoom+'; pinch to explore.');
      diag('Centered globe on selected location (coordinates omitted), zoom '+lastZoom);
    }
  };
  const priorClear=controller.clearLocation;
  controller.clearLocation=function() {
    priorClear();
    currentPlace=null;
    syncMarker();
  };
  // The ES-module loader dispatches this after MapLibre is actually available.
  window.addEventListener('here-now-globe-ready',toGlobe);
  if(window.maplibregl) toGlobe();
})();