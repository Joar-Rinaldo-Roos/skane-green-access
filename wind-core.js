/* Here & Now v1.0.5 — DWD ICON global 10 m surface wind arrows.
 * Vector geometry comes from the official Open-Meteo MapLibre OM arrows renderer.
 * The vector variable is wind_u_component_10m; the protocol reads the
 * companion wind_v_component_10m to calculate flow direction and magnitude.
 * Forecast arrows are model output, not live wind observations. */
(function(root){
 'use strict';
 const METADATA='https://openmeteo.s3.amazonaws.com/data_spatial/dwd_icon/latest.json';
 function metadataUrl(){return METADATA;}
 function buildWindFrames(metadata,now=new Date(),hours=48,spacingHours=3){
   const variables=metadata?.variables;
   if(!Array.isArray(variables)||!variables.includes('wind_u_component_10m')||
      !variables.includes('wind_v_component_10m'))
     throw Error('10 m wind vector components are unavailable in the current model');
   if(!Array.isArray(metadata?.valid_times)||!metadata.valid_times.length)
     throw Error('No published wind forecast hours');
   const stamp=now instanceof Date?now.getTime():new Date(now).getTime();
   if(!Number.isFinite(stamp))throw Error('Invalid forecast date');
   if(!Number.isSafeInteger(hours)||hours<1||hours>72||
      !Number.isSafeInteger(spacingHours)||spacingHours<1||spacingHours>12)
     throw Error('Invalid forecast horizon or spacing');
   const valid=metadata.valid_times.map((time,index)=>{
     const epoch=typeof time==='string'&&/Z$|[+-]\d\d:\d\d$/.test(time)?Date.parse(time):NaN;
     return {index,time,epoch,offsetHours:(epoch-stamp)/3600000};
   }).filter(x=>Number.isFinite(x.epoch)&&x.epoch>=stamp-3600000&&x.epoch<=stamp+hours*3600000)
     .sort((a,b)=>a.epoch-b.epoch||a.index-b.index);
   if(!valid.length)throw Error('No published wind forecast hours within 48 h');
   let first=valid[0],diff=Math.abs(valid[0].epoch-stamp);
   for(const frame of valid){const d=Math.abs(frame.epoch-stamp);if(d<diff){first=frame;diff=d;}}
   const frames=[first];let last=first.epoch;
   for(const frame of valid){
     if(frame.epoch>last&&frame.epoch-last>=spacingHours*3600000-60000){
       frames.push(frame);last=frame.epoch;
     }
   }
   return {frames,variable:'wind_u_component_10m',referenceTime:metadata.reference_time||null,hours};
 }
 function windUrl(frame){
   if(!Number.isSafeInteger(frame?.index)||frame.index<0||frame.index>10000)
     throw Error('Invalid wind forecast model time index');
   return 'om://'+METADATA+'?'+new URLSearchParams({
     time_step:'valid_times_'+frame.index,variable:'wind_u_component_10m',arrows:'true'
   }).toString();
 }
 function windSource(frame){
   return {type:'vector',url:windUrl(frame),maxzoom:12,attribution:'DWD ICON 10 m forecast wind © Open-Meteo'};
 }
 function windLayer(visible=true){
   return {id:'hn-wind-arrows',type:'line',source:'hn-wind','source-layer':'wind-arrows',
     paint:{
       'line-color':'#172f39',
       'line-opacity':0.88,
       'line-width':['interpolate',['linear'],['zoom'],0,1,5,1.5,10,2.0]
     },
     layout:{visibility:visible?'visible':'none','line-cap':'round','line-join':'round'}};
 }
 function nextWindFrame(index,length){
   return Number.isInteger(index)&&index>=0&&Number.isInteger(length)&&length>1&&index<length-1?index+1:null;
 }
 const api={metadataUrl,buildWindFrames,windUrl,windSource,windLayer,nextWindFrame};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.HereNowWindCore=api;
})(typeof window==='undefined'?null:window);
