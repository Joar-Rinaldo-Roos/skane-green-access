/* Here & Now v1.0.10 — automatically warm FIRST forecast frame of all 4 layers.
 * Once the globe is usable, stagger 4 low-zoom (maxzoom 4) near-transparent
 * Open-Meteo sources in the CURRENT viewport. No layer is selected by this.
 * The actual visible weather layers still load at their requested resolution.
 * This is best-effort worker/HTTP preloading, not a persistent offline cache.
 */
(function(root){
 'use strict';
 const MAX_ZOOM=4;
 const START_DELAY_MS=1200;
 const STAGGER_MS=650;
 const TYPES=[
   {key:'temperature',source:'HereNowTemperatureCore',builder:'temperatureSource',
      variable:'temperature_2m',type:'raster'},
   {key:'rain',source:'HereNowRainCore',builder:'rainSource',
      variable:'precipitation',type:'raster'},
   {key:'clouds',source:'HereNowCloudCore',builder:'cloudSource',
      variable:'cloud_cover',type:'raster'},
   {key:'wind',source:'HereNowWindCore',builder:'windSource',
      variable:'wind_u_component_10m',type:'vector'}
 ];
 function allowed(win){
   const conn=win?.navigator?.connection;
   return !Boolean(conn?.saveData||conn?.effectiveType==='2g'||conn?.effectiveType==='slow-2g');
 }
 function initialFrame(win,metadata,now=new Date()){
   return win?.HereNowWeatherTimelineCore?.buildTimeline(metadata,now,48,3)?.frames?.[0]||null;
 }
 function sourceId(key){return 'hn-first-'+key;}
 function layerId(key){return 'hn-first-'+key+'-preview';}
 function specs(win,metadata,frame){
   const variables=metadata?.variables||[];
   if(!frame||!Number.isSafeInteger(frame.index)||!Array.isArray(variables))return [];
   return TYPES.filter(item=>{
     const present=variables.includes(item.variable)||
       (item.key==='rain'&&variables.includes('rain'));
     const windCompanion=item.key!=='wind'||variables.includes('wind_v_component_10m');
     return present&&windCompanion&&typeof win?.[item.source]?.[item.builder]==='function';
   }).map(item=>{
     const actualVar=item.key==='rain'&&!variables.includes('precipitation')?'rain':undefined;
     const original=win[item.source][item.builder](frame,actualVar);
     const source={...original,maxzoom:Math.min(MAX_ZOOM,original.maxzoom||MAX_ZOOM)};
     return {key:item.key,source};
   }).filter(item=>['raster','vector'].includes(item.source.type)&&
     typeof item.source.url==='string'&&item.source.url.startsWith('om://'));
 }
 function layer(spec){
   const common={id:layerId(spec.key),source:sourceId(spec.key),
     layout:{visibility:'visible'}};
   return spec.source.type==='vector'?
     {...common,type:'line','source-layer':'wind-arrows',
       paint:{'line-color':'#172f39','line-opacity':0.002,'line-width':0.5}}:
     {...common,type:'raster',
       paint:{'raster-opacity':0.002,'raster-fade-duration':0}};
 }
 function before(map){
   for(const id of ['hn-temperature-raster','hn-rain-raster','hn-clouds-raster',
                    'hn-wind-arrows','sgu-soil-fill','hn-green-wood-tiles']){
     if(map.getLayer(id))return id;
   }
   return undefined;
 }
 const helpers={MAX_ZOOM,START_DELAY_MS,STAGGER_MS,TYPES,allowed,initialFrame,specs,layer,sourceId,layerId};
 if(typeof module!=='undefined'&&module.exports)module.exports=helpers;
 if(!root?.document)return;
 const status=root.document.getElementById('weather-first-frames-status');
 const say=msg=>{if(status)status.textContent=msg;};
 const log=msg=>root.HereNowDiagnostics?.log('First weather frames',msg);
 let mapReady=null,started=false,launchTimer=null;
 const stepTimers=new Set(),queued=new Set(),loaded=new Set();
 let bootId=0;
 function anyActive(){
   return ['HereNowTemperature','HereNowRain','HereNowClouds','HereNowWind']
     .some(name=>root[name]?.isEnabled?.());
 }
 function cancelPending(){
   if(launchTimer!==null){clearTimeout(launchTimer);launchTimer=null;}
   for(const timer of stepTimers)clearTimeout(timer);
   stepTimers.clear();
 }
 function stopForUser(){
   if(!started)return;
   cancelPending();
   if(queued.size)log('Prioritizing selected weather layer over remaining background preloads.');
 }
 async function start(id){
   launchTimer=null;
   if(!allowed(root)){
     say('Automatic frame preloading skipped on Data Saver / slow network.');
     return;
   }
   const map=root.HereNowGlobe?.getMap?.();
   if(!map?.isStyleLoaded?.()||map!==mapReady||anyActive())return;
   started=true;
   say('Preparing first Temperature, Rain, Clouds and Wind forecast frames…');
   try{
     const data=root.HereNowWeatherData;
     if(!data?.getMetadata||!root.HereNowTemperature?.ensureProtocol)
       throw Error('Weather metadata or renderer is not yet ready');
     // Reuse the same short-lived model metadata cache as the user-facing timeline.
     const [metadata]=await Promise.all([data.getMetadata(),root.HereNowTemperature.ensureProtocol()]);
     if(id!==bootId||map!==root.HereNowGlobe?.getMap?.()||anyActive())return;
     const frame=initialFrame(root,metadata);
     if(!frame)throw Error('No current forecast frame');
     const items=specs(root,metadata,frame);
     if(items.length!==4)
       log('Model offers '+items.length+' of 4 global first-frame variables');
     if(!items.length)throw Error('No compatible weather source available');
     items.forEach((spec,i)=>{
       const timer=setTimeout(()=>{
         stepTimers.delete(timer);
         if(id!==bootId||anyActive()||!map.isStyleLoaded?.())return;
         try{
           if(!map.getSource(sourceId(spec.key))){
             map.addSource(sourceId(spec.key),spec.source);
             map.addLayer(layer(spec),before(map));
           }
           queued.add(spec.key);
           say('Preparing weather frames: '+queued.size+'/'+items.length+' requested; '+
             loaded.size+' loaded. No overlays enabled yet.');
         }catch(error){
           log(spec.key+' first-frame preview failed: '+String(error?.message||error));
         }
       },i*STAGGER_MS);
       stepTimers.add(timer);
     });
   }catch(error){
     log('First-frame preloading unavailable: '+String(error?.message||error));
     say('Weather preloading unavailable; layers will still load when selected.');
   }
 }
 function onGlobeReady(){
   const map=root.HereNowGlobe?.getMap?.();
   if(!map||!map.isStyleLoaded?.()||map===mapReady)return;
   cancelPending();
   ++bootId;mapReady=map;started=false;
   queued.clear();loaded.clear();
   if(!allowed(root)){
     say('Automatic frame preloading skipped on Data Saver / slow network.');
     return;
   }
   map.on('sourcedata',event=>{
     if(map!==mapReady||!event?.isSourceLoaded)return;
     const key=TYPES.find(item=>sourceId(item.key)===event.sourceId)?.key;
     if(!key||!queued.has(key)||loaded.has(key))return;
     loaded.add(key);
     say('First weather frames: '+loaded.size+'/'+queued.size+
       ' requested previews loaded. Ready to choose a layer.');
   });
   const id=bootId;
   launchTimer=setTimeout(()=>start(id),START_DELAY_MS);
 }
 for(const id of ['toggle-temperature','toggle-rain','toggle-clouds','toggle-wind']){
   root.document.getElementById(id)?.addEventListener('click',stopForUser);
 }
 root.addEventListener?.('here-now-globe-map-ready',onGlobeReady);
 // Also handle a MapLibre globe that became ready before this script executed.
 onGlobeReady();
 root.HereNowFirstFrames={start:()=>{onGlobeReady();return started;},stopForUser,
   requested:()=>queued.size,loaded:()=>loaded.size};
})(typeof window==='undefined'?null:window);
