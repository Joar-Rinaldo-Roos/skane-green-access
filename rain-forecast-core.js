/* Here & Now global precipitation forecast logic (browser + Node unit tests).
 * Times and indices always come from actual Open-Meteo model metadata.
 * The precipitation layer visualizes a model FORECAST, not observed rain radar. */
(function(root){
  'use strict';
  const METADATA='https://openmeteo.s3.amazonaws.com/data_spatial/dwd_icon/latest.json';
  function chooseRainVariable(variables){
    if(!Array.isArray(variables))return null;
    if(variables.includes('precipitation'))return 'precipitation';
    if(variables.includes('rain'))return 'rain';
    return null;
  }
  function buildRainFrames(metadata,now=new Date(),horizonHours=48,spacingHours=3){
    const variable=chooseRainVariable(metadata?.variables);
    if(!variable)throw Error('Precipitation unavailable in the selected global model');
    if(!Array.isArray(metadata?.valid_times)||!metadata.valid_times.length)
      throw Error('No model forecast times available');
    const epoch=now instanceof Date?now.getTime():new Date(now).getTime();
    if(!Number.isFinite(epoch))throw Error('Invalid current time');
    if(!Number.isInteger(horizonHours)||horizonHours<1||horizonHours>72)throw Error('Invalid forecast horizon');
    if(!Number.isInteger(spacingHours)||spacingHours<1||spacingHours>12)throw Error('Invalid timeline spacing');

    const end=epoch+horizonHours*3600000;
    const valid=metadata.valid_times.map((value,index)=>{
      const ms=typeof value==='string'&&/Z$|[+-]\d\d:\d\d$/.test(value)?Date.parse(value):NaN;
      return {index,time:value,epoch:ms,offsetHours:(ms-epoch)/3600000,timeStep:'valid_times_'+index};
    }).filter(f=>Number.isFinite(f.epoch)&&f.epoch>=epoch-3600000&&f.epoch<=end)
      .sort((a,b)=>a.epoch-b.epoch||a.index-b.index);

    if(!valid.length)throw Error('No model forecast times available for the next 48 hours');
    let first=valid[0],difference=Math.abs(valid[0].epoch-epoch);
    for(const candidate of valid){
      const delta=Math.abs(candidate.epoch-epoch);
      if(delta<difference){first=candidate;difference=delta;}
    }
    const frames=[first];
    let lastTime=first.epoch;
    const step=spacingHours*3600000;
    for(const candidate of valid){
      if(candidate.epoch>lastTime && candidate.epoch-lastTime>=step-60000){
        frames.push(candidate);lastTime=candidate.epoch;
      }
    }
    return {variable,frames,referenceTime:metadata.reference_time||null,
      horizonHours,spacingHours};
  }
  function rainUrl(frame,variable='precipitation'){
    if(!Number.isSafeInteger(frame?.index)||frame.index<0||frame.index>10000)
      throw Error('Invalid model time index');
    if(variable!=='precipitation'&&variable!=='rain')throw Error('Invalid precipitation variable');
    const params=new URLSearchParams({variable,time_step:'valid_times_'+frame.index});
    return 'om://'+METADATA+'?'+params.toString();
  }
  function rainSource(frame,variable='precipitation'){
    return {type:'raster',url:rainUrl(frame,variable),maxzoom:12,tileSize:512,
      attribution:'Forecast precipitation © Open-Meteo · DWD ICON Global'};
  }
  function rainLayer(enabled=true){
    return {id:'hn-rain-raster',type:'raster',source:'hn-rain',
      paint:{'raster-opacity':0.77,'raster-fade-duration':0},
      layout:{visibility:enabled?'visible':'none'}};
  }
  function nextFrameIndex(index,length){
    if(!Number.isInteger(index)||index<0||!Number.isInteger(length)||length<1||index>=length-1)return null;
    return index+1;
  }
  const api={buildRainFrames,rainUrl,rainSource,rainLayer,nextFrameIndex,chooseRainVariable,
    metadataUrl:()=>METADATA};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.HereNowRainCore=api;
})(typeof window==='undefined'?null:window);
