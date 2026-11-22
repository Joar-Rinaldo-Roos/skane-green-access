/* Here & Now v1.0.11 — preload REAL first-frame sources behind the globe.
 * v1.0.10 only built separate low-resolution preview sources and could miss the
 * globe-ready event while MapLibre was updating style on load. Neither the
 * previews nor their tile cache could be claimed by the real weather layers.
 *
 * After MapLibre becomes style-ready, create the ORIGINAL hn-temperature,
 * hn-rain, hn-clouds and hn-wind source/layer IDs at their native maxzoom.
 * Each layer is rendered at 0.002 opacity to load tiles without switching UI.
 * Enabling a layer simply restores its normal opacity and claims the source.
 * One current DWD ICON valid_times_N timestamp shared by all four.
 *
 * The startup load is staggered and skipped on Data Saver / 2G. Four real
 * weather sources consume bandwidth and GPU memory; they follow the viewport
 * and do NOT download the entire world or the 48-hour model.
 */
(function(root){
 'use strict';
 const START_DELAY_MS=350;
 const RETRY_MS=700;
 const RETRY_LIMIT=15;
 const STAGGER_MS=650;
 const PREVIEW_OPACITY=0.002;
 const TYPES=[
   {key:'temperature',core:'HereNowTemperatureCore',sourceBuilder:'temperatureSource',
    layerBuilder:'temperatureLayer',sourceId:'hn-temperature',layerId:'hn-temperature-raster',
    variable:'temperature_2m',opacity:'raster-opacity'},
   {key:'rain',core:'HereNowRainCore',sourceBuilder:'rainSource',
    layerBuilder:'rainLayer',sourceId:'hn-rain',layerId:'hn-rain-raster',
    variable:'precipitation',opacity:'raster-opacity'},
   {key:'clouds',core:'HereNowCloudCore',sourceBuilder:'cloudSource',
    layerBuilder:'cloudLayer',sourceId:'hn-clouds',layerId:'hn-clouds-raster',
    variable:'cloud_cover',opacity:'raster-opacity'},
   {key:'wind',core:'HereNowWindCore',sourceBuilder:'windSource',
    layerBuilder:'windLayer',sourceId:'hn-wind',layerId:'hn-wind-arrows',
    variable:'wind_u_component_10m',opacity:'line-opacity'}
 ];
 function allowed(win){
   const network=win?.navigator?.connection;
   return !Boolean(network?.saveData||network?.effectiveType==='2g'||
     network?.effectiveType==='slow-2g');
 }
 function initialFrame(win,metadata,now=new Date()){
   return win?.HereNowWeatherTimelineCore?.buildTimeline(metadata,now,48,3)?.frames?.[0]||null;
 }
 function specs(win,metadata,frame){
   const variables=metadata?.variables||[];
   if(!Number.isSafeInteger(frame?.index)||!Array.isArray(variables))return [];
   return TYPES.filter(t=>{
     return (variables.includes(t.variable)||(t.key==='rain'&&variables.includes('rain'))) &&
       (t.key!=='wind'||variables.includes('wind_v_component_10m')) &&
       typeof win?.[t.core]?.[t.sourceBuilder]==='function' &&
       typeof win?.[t.core]?.[t.layerBuilder]==='function';
   }).map(t=>{
     const variable=t.key==='rain'&&!variables.includes('precipitation')?'rain':undefined;
     const source=win[t.core][t.sourceBuilder](frame,variable);
     const layer=win[t.core][t.layerBuilder](true);
     return {...t,source,layer};
   }).filter(t=>['raster','vector'].includes(t.source?.type)&&
     t.source.url?.startsWith('om://')&&t.layer.id===t.layerId);
 }
 function prepLayer(spec){
   return {...spec.layer,
     layout:{...spec.layer.layout,visibility:'visible'},
     paint:{...spec.layer.paint,[spec.opacity]:PREVIEW_OPACITY}};
 }
 function before(map,key){
   if(key==='wind')return undefined;
   const candidates=key==='temperature'?
     ['hn-clouds-raster','sgu-soil-fill','hn-green-wood-tiles']:
     key==='rain'?['hn-temperature-raster','sgu-soil-fill','hn-green-wood-tiles']:
       ['sgu-soil-fill','hn-green-wood-tiles'];
   return candidates.find(id=>Boolean(map.getLayer(id)));
 }
 const helpers={START_DELAY_MS,RETRY_MS,RETRY_LIMIT,STAGGER_MS,PREVIEW_OPACITY,
   TYPES,allowed,initialFrame,specs,prepLayer,before};
 if(typeof module!=='undefined'&&module.exports)module.exports=helpers;
 if(!root?.document)return;
 const status=root.document.getElementById('weather-first-frames-status');
 const say=text=>{if(status)status.textContent=text;};
 const log=text=>root.HereNowDiagnostics?.log('First weather frames',text);
 let mapReady=null,launchTimer=null,starting=false,attempts=0,bootId=0;
 const timers=new Set(),prepared=new Map(),requested=new Set(),loaded=new Set();
 function anyActive(){
   return ['HereNowTemperature','HereNowRain','HereNowClouds','HereNowWind']
     .some(name=>Boolean(root[name]?.isEnabled?.()));
 }
 function cancelTimers(){
   if(launchTimer!==null){clearTimeout(launchTimer);launchTimer=null;}
   for(const id of timers)clearTimeout(id);
   timers.clear();
 }
 function userSelected(){
   cancelTimers();
   if(starting){
     say('Weather layer selected. '+loaded.size+'/'+requested.size+
       ' background sources reported ready; prioritizing your selection.');
   }
 }
 function report(){
   say('First weather frames: '+loaded.size+'/'+requested.size+
     ' real layer sources ready. Choose Temperature, Rain, Clouds or Wind.');
 }
 function claim(key,url){
   const found=prepared.get(key);
   const map=root.HereNowGlobe?.getMap?.();
   if(!found||!map||found.map!==map||found.url!==url||
      !map.getSource(found.sourceId)||!map.getLayer(found.layerId))return false;
   prepared.delete(key);
   return true;
 }
 function frameFor(key){
   const item=prepared.get(key);
   return item?.map===root.HereNowGlobe?.getMap?.()?item.frame:null;
 }
 function addOne(map,spec,frame,id){
   if(id!==bootId||map!==mapReady||anyActive())return;
   try{
     if(map.getSource(spec.sourceId)||map.getLayer(spec.layerId))return;
     // Source IDs and native maximum zoom exactly match eventual visible layers.
     map.addSource(spec.sourceId,spec.source);
     map.addLayer(prepLayer(spec),before(map,spec.key));
     prepared.set(spec.key,{map,url:spec.source.url,sourceId:spec.sourceId,
       layerId:spec.layerId,frame});
     requested.add(spec.key);
     report();
   }catch(error){
     log(spec.key+' source prewarm failed: '+String(error?.message||error));
     say('Could not preload '+spec.key+'; normal weather selection remains available.');
   }
 }
 async function run(id){
   launchTimer=null;
   const map=mapReady;
   if(!map||id!==bootId||anyActive()||starting)return;
   if(!allowed(root)){
     say('Background weather preloading skipped on Data Saver or a slow connection.');
     return;
   }
   if(!map.isStyleLoaded?.()){
     if(++attempts<=RETRY_LIMIT){
       say('Globe displayed. Waiting for its map style to finish loading before weather preloading…');
       launchTimer=setTimeout(()=>run(id),RETRY_MS);
     }else say('Globe is displayed, but weather preload could not start. Weather buttons still work.');
     return;
   }
   starting=true;
   say('Globe ready. Fetching first-frame weather data for all four layers…');
   try{
     const data=root.HereNowWeatherData;
     if(!data?.getMetadata||!root.HereNowTemperature?.ensureProtocol)
       throw Error('Weather metadata cache or renderer unavailable');
     const [metadata]=await Promise.all([
       data.getMetadata(),root.HereNowTemperature.ensureProtocol()
     ]);
     if(id!==bootId||map!==mapReady||anyActive())return;
     const frame=initialFrame(root,metadata);
     if(!frame)throw Error('No published current model timestamp');
     const items=specs(root,metadata,frame);
     if(!items.length)throw Error('No compatible weather layers in model');
     if(items.length<4)log('Only '+items.length+' of four model variables available');
     for(const [i,spec] of items.entries()){
       const timer=setTimeout(()=>{
         timers.delete(timer);
         addOne(map,spec,frame,id);
       },i*STAGGER_MS);
       timers.add(timer);
     }
   }catch(error){
     log('Startup preloader unavailable: '+String(error?.message||error));
     say('Weather preloading unavailable: '+String(error?.message||error)+
       '. You can still tap any weather layer.');
   }
 }
 function onGlobeReady(){
   const map=root.HereNowGlobe?.getMap?.();
   if(!map||map===mapReady)return;
   cancelTimers();
   mapReady=map;bootId++;attempts=0;starting=false;
   prepared.clear();requested.clear();loaded.clear();
   if(!allowed(root)){
     say('Background weather preloading skipped on Data Saver or a slow connection.');
     return;
   }
   say('Globe detected. Preparing automatic weather loading…');
   map.on('sourcedata',event=>{
     if(map!==mapReady||!event?.isSourceLoaded)return;
     const item=TYPES.find(t=>t.sourceId===event.sourceId);
     if(!item||!requested.has(item.key))return;
     loaded.add(item.key);
     report();
   });
   map.on('error',event=>{
     if(map!==mapReady)return;
     const item=TYPES.find(t=>t.sourceId===event.sourceId);
     if(item&&requested.has(item.key))log(item.key+' preload tile error: '+
       String(event.error?.message||'unknown').slice(0,180));
   });
   const id=bootId;
   launchTimer=setTimeout(()=>run(id),START_DELAY_MS);
 }
 root.HereNowFirstFrames={claim,frameFor,requested:()=>requested.size,
   loaded:()=>loaded.size,onGlobeReady,userSelected};
 for(const name of ['toggle-temperature','toggle-rain','toggle-clouds','toggle-wind'])
   root.document.getElementById(name)?.addEventListener('click',userSelected);
 root.addEventListener?.('here-now-globe-map-ready',onGlobeReady);
 onGlobeReady();
})(typeof window==='undefined'?null:window);
