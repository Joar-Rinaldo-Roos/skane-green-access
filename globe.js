/* v1.0.8: single MapLibre globe. No Leaflet 2D map or duplicated OSM requests.
 * SGU soil polygons remain available from the lightweight globe controller. */
(function () {
  'use strict';
  const globeContainer=document.getElementById('globe-map');
  const controller=window.HereNowMap;
  if (!globeContainer || !controller) return;

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
      const soilLabel=feature.properties?.jg2_tx || feature.properties?.jg2 || 'Unclassified';
      const card=window.HereNowSoil?.createSummary(soilLabel) || document.createTextNode(String(soilLabel));
      new maplibregl.Popup({maxWidth:'320px'}).setLngLat(event.lngLat).setDOMContent(card).addTo(globeMap);
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

  function failGlobe(message) {
    diag(message);
    if (globeMap) {try {globeMap.remove();}catch (_){} globeMap=null;}
    globeReady=false;
    globeActive=false;
    controller.setStatus(message+' WebGL is required for the 3D globe.');
  }
  function toGlobe() {
    if (!window.maplibregl) {
      const state=window.HereNowGlobeLoader?.state;
      controller.setStatus(state==='error'?'Globe library failed to load. Check diagnostics.':'Globe library is loading. Try again shortly.');
      return;
    }
    if (typeof maplibregl.supported==='function' && !maplibregl.supported()) {
      controller.setStatus('WebGL is not available. This globe-only version requires WebGL.');
      diag('WebGL unsupported');return;
    }
    globeActive=true;
    globeContainer.hidden=false;
    controller.setStatus('3D globe active. Drag to rotate; pinch to zoom.');
    if (globeMap) {
      globeMap.resize();
      window.HereNowGreenSpaces?.repaint?.();
      window.HereNowGreenSpaces?.scheduleRefresh?.();
      window.dispatchEvent?.(typeof Event==='function'?new Event('here-now-globe-map-ready'):{type:'here-now-globe-map-ready'});
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
        attributionControl:true,
        // Always-on larger tile retention, device-aware for low-memory phones.
        // Next-frame preloader separately warms only one low-zoom forecast source.
        maxTileCacheSize:window.HereNowTileCache?.maxTiles?.()||72
      });
      globeMap.on('style.load',()=>globeMap.setProjection({type:'globe'}));
      globeMap.on('load',()=>{
        globeReady=true;
        syncMarker();
        paintSoil();
        window.HereNowGreenSpaces?.repaint?.();
        window.HereNowGreenSpaces?.onMapReady?.();
        window.HereNowGreenSpaces?.scheduleRefresh?.();
        window.dispatchEvent?.(typeof Event==='function'?new Event('here-now-globe-map-ready'):{type:'here-now-globe-map-ready'});
        if(currentPlace) setViewFromPlace(currentPlace,lastZoom);
        controller.scheduleGeologyRefresh?.();
        if(globeActive)controller.setStatus('Globe ready. Find me zooms to your GPS location; Soil geology adds SGU polygons.');
      });
      globeMap.on('moveend',()=>{if(globeActive){controller.scheduleGeologyRefresh?.();window.HereNowGreenSpaces?.scheduleRefresh?.();window.HereNowNextRain?.onMapMoved?.();}});
      globeMap.on('error',event=>{diag('MapLibre resource/render error; globe may be partially available');});
    } catch(error) {
      failGlobe('The 3D globe could not start.');
    }
  }

  // The globe viewport drives SGU queries and all map-center discovery.
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
  function zoomTo(zoom=13){
    if(!globeActive||!globeMap||!globeReady||!Number.isFinite(zoom))return false;
    globeMap.jumpTo({zoom});
    return true;
  }
  window.HereNowGlobe={getMap:()=>globeReady?globeMap:null,isActive:()=>globeActive,zoomTo};
  // Automatically initialize the globe as soon as MapLibre is available.
  window.addEventListener('here-now-globe-ready',toGlobe);
  if(window.maplibregl) toGlobe();
})();