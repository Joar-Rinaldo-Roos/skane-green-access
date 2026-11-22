/* Here & Now v1.0.7 — shared forecast metadata cache and gentle warm-up.
 * Avoids 4+ duplicate latest.json fetches and late first-use renderer import.
 * Does NOT download weather tiles/models in bulk; mobile data saving is respected.
 * Model metadata expires after 5 minutes so valid_times_N indices don't go stale. */
(function(){
 'use strict';
 const URL='https://openmeteo.s3.amazonaws.com/data_spatial/dwd_icon/latest.json';
 const STORAGE_KEY='here-now:dwd-icon-metadata:v1';
 const TTL_MS=5*60*1000;
 let latest=null,pending=null,prepared=false,preparing=null;
 const log=message=>window.HereNowDiagnostics?.log('Weather cache',message);
 function valid(data){
   return data&&Array.isArray(data.valid_times)&&data.valid_times.length>0&&
     Array.isArray(data.variables)&&data.variables.length>0;
 }
 function readStored(){
   try{
     const stored=JSON.parse(window.sessionStorage?.getItem(STORAGE_KEY)||'null');
     if(stored&&Number.isFinite(stored.saved)&&Date.now()-stored.saved<TTL_MS&&
        stored.saved<=Date.now()&&valid(stored.data))return stored;
   }catch(error){log('Session metadata cache unreadable; fetching fresh data.');}
   return null;
 }
 function store(record){
   try{window.sessionStorage?.setItem(STORAGE_KEY,JSON.stringify(record));}
   catch(error){log('Browser storage unavailable; continuing with memory cache.');}
 }
 function getMetadata(){
   const now=Date.now();
   if(latest&&now-latest.saved<TTL_MS&&now>=latest.saved)return Promise.resolve(latest.data);
   if(pending)return pending;
   const saved=readStored();
   if(saved){latest=saved;return Promise.resolve(saved.data);}
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),14000);
   pending=(async()=>{
     const response=await fetch(URL,{signal:controller.signal,cache:'default'});
     if(!response.ok)throw Error('Weather metadata HTTP '+response.status);
     const data=await response.json();
     if(!valid(data))throw Error('Weather model metadata missing variables or forecast hours');
     latest={data,saved:Date.now()};
     store(latest);
     return data;
   })().catch(error=>{
     log('Weather metadata request failed: '+String(error?.message||error));
     throw error;
   }).finally(()=>{clearTimeout(timeout);pending=null;});
   return pending;
 }
 function dataSaver(){
   const network=window.navigator?.connection;
   return Boolean(network?.saveData||network?.effectiveType==='slow-2g'||network?.effectiveType==='2g');
 }
 function prepareRenderer(){
   if(prepared)return Promise.resolve(true);
   if(preparing)return preparing;
   if(!window.maplibregl||!window.HereNowTemperature?.ensureProtocol)
     return Promise.resolve(false);
   preparing=window.HereNowTemperature.ensureProtocol().then(()=>{
     prepared=true;log('OM renderer preloaded for next weather overlay');return true;
   }).catch(error=>{
     log('Renderer preloading deferred: '+String(error?.message||error));return false;
   }).finally(()=>{preparing=null;});
   return preparing;
 }
 function warm(){
   if(dataSaver())return Promise.resolve(false);
   // Both tasks are independent; failures must not affect site initialization.
   return Promise.allSettled([getMetadata(),prepareRenderer()]).then(()=>true);
 }
 function schedule(){
   if(dataSaver()){log('Data Saver or slow connection: skipping automatic prefetch.');return;}
   // Delay until user-facing page scripts and the first map frame have loaded.
   const run=()=>{warm().catch(()=>{});};
   if(typeof window.requestIdleCallback==='function'){
     window.requestIdleCallback(run,{timeout:3500});
   }else{
     setTimeout(run,1100);
   }
 }
 window.addEventListener('here-now-globe-map-ready',()=>{
   if(!dataSaver())prepareRenderer();
 });
 window.HereNowWeatherData={getMetadata,prepareRenderer,warm,
   isCached:()=>Boolean(latest&&Date.now()-latest.saved<TTL_MS),
   dataSaver};
 schedule();
})();
