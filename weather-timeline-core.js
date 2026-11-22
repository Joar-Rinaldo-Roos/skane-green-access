/* Here & Now v1.0.6 — one authoritative forecast timeline for weather overlays.
 * The global model supplies actual indexed valid_times; never invent animation hours.
 * This module is usable by browsers and Node tests without GPS or an API key. */
(function(root){
  'use strict';
  const METADATA='https://openmeteo.s3.amazonaws.com/data_spatial/dwd_icon/latest.json';
  function metadataUrl(){return METADATA;}
  function buildTimeline(metadata,now=new Date(),hours=48,stepHours=3){
    if(!Array.isArray(metadata?.valid_times)||!metadata.valid_times.length)
      throw Error('Weather model has no forecast times');
    if(!Number.isSafeInteger(hours)||hours<1||hours>72||
       !Number.isSafeInteger(stepHours)||stepHours<1||stepHours>12)
      throw Error('Invalid forecast timeline range');
    const nowMs=now instanceof Date?now.getTime():new Date(now).getTime();
    if(!Number.isFinite(nowMs))throw Error('Invalid current date');
    const valid=metadata.valid_times.map((time,index)=>{
      const epoch=typeof time==='string'&&/Z$|[+-]\d\d:\d\d$/.test(time)?Date.parse(time):NaN;
      return {index,time,epoch,offsetHours:(epoch-nowMs)/3600000};
    }).filter(f=>Number.isFinite(f.epoch)&&f.epoch>=nowMs-3600000&&f.epoch<=nowMs+hours*3600000)
      .sort((a,b)=>a.epoch-b.epoch||a.index-b.index);
    if(!valid.length)throw Error('No forecast hours in the next '+hours+' hours');
    let first=valid[0],smallest=Math.abs(first.epoch-nowMs);
    for(const frame of valid){
      const delta=Math.abs(frame.epoch-nowMs);
      if(delta<smallest){smallest=delta;first=frame;}
    }
    const frames=[first];let last=first.epoch;
    for(const frame of valid){
      if(frame.epoch>last&&frame.epoch-last>=stepHours*3600000-60000){
        frames.push(frame);last=frame.epoch;
      }
    }
    return {frames,referenceTime:metadata.reference_time||null,hours,stepHours};
  }
  function nextFrame(current,length){
    return Number.isInteger(current)&&Number.isInteger(length)&&current>=0&&
      length>1&&current<length-1?current+1:null;
  }
  const api={metadataUrl,buildTimeline,nextFrame};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.HereNowWeatherTimelineCore=api;
})(typeof window==='undefined'?null:window);
