/* Here & Now v1.0.3: global total cloud-cover forecast (%), not satellite imagery.
 * Selects only real DWD ICON model valid_times for a 48-hour timeline.
 * Browser + Node compatible; no GPS, credential or per-location API calls. */
(function(root){
  'use strict';
  const METADATA='https://openmeteo.s3.amazonaws.com/data_spatial/dwd_icon/latest.json';
  function metadataUrl(){return METADATA;}
  function buildCloudFrames(metadata,now=new Date(),horizonHours=48,spacingHours=3){
    if(!Array.isArray(metadata?.variables)||!metadata.variables.includes('cloud_cover'))
      throw Error('Total cloud cover unavailable in the selected global weather model');
    if(!Array.isArray(metadata?.valid_times)||!metadata.valid_times.length)
      throw Error('No cloud cover forecast times available');
    const epoch=now instanceof Date?now.getTime():new Date(now).getTime();
    if(!Number.isFinite(epoch))throw Error('Invalid current time');
    if(!Number.isInteger(horizonHours)||horizonHours<1||horizonHours>72)
      throw Error('Invalid forecast horizon');
    if(!Number.isInteger(spacingHours)||spacingHours<1||spacingHours>12)
      throw Error('Invalid timeline spacing');

    const cutoff=epoch+horizonHours*3600000;
    const valid=metadata.valid_times.map((time,index)=>{
      const millis=typeof time==='string'&&/Z$|[+-]\d\d:\d\d$/.test(time)?Date.parse(time):NaN;
      return {index,time,epoch:millis,offsetHours:(millis-epoch)/3600000,timeStep:'valid_times_'+index};
    }).filter(frame=>Number.isFinite(frame.epoch)&&frame.epoch>=epoch-3600000&&frame.epoch<=cutoff)
      .sort((a,b)=>a.epoch-b.epoch||a.index-b.index);
    if(!valid.length)throw Error('No cloud cover forecast times available for the next 48 hours');
    let nearest=valid[0],difference=Math.abs(nearest.epoch-epoch);
    for(const frame of valid){
      const diff=Math.abs(frame.epoch-epoch);
      if(diff<difference){nearest=frame;difference=diff;}
    }
    const frames=[nearest];
    let last=nearest.epoch;
    for(const frame of valid){
      if(frame.epoch>last&&frame.epoch-last>=spacingHours*3600000-60000){
        frames.push(frame);
        last=frame.epoch;
      }
    }
    return {variable:'cloud_cover',frames,referenceTime:metadata.reference_time||null,horizonHours,spacingHours};
  }
  function cloudUrl(frame){
    if(!Number.isSafeInteger(frame?.index)||frame.index<0||frame.index>10000)
      throw Error('Invalid model time index');
    return 'om://'+METADATA+'?'+new URLSearchParams({
      variable:'cloud_cover',time_step:'valid_times_'+frame.index
    }).toString();
  }
  function cloudSource(frame){
    return {type:'raster',url:cloudUrl(frame),maxzoom:12,tileSize:512,
      attribution:'Forecast total cloud cover © Open-Meteo · DWD ICON Global'};
  }
  function cloudLayer(enabled=true){
    return {id:'hn-clouds-raster',type:'raster',source:'hn-clouds',
      paint:{'raster-opacity':0.62,'raster-fade-duration':0},
      layout:{visibility:enabled?'visible':'none'}};
  }
  function nextCloudFrameIndex(index,length){
    if(!Number.isInteger(index)||index<0||!Number.isInteger(length)||length<1||index>=length-1)return null;
    return index+1;
  }
  const api={buildCloudFrames,cloudUrl,cloudSource,cloudLayer,nextCloudFrameIndex,metadataUrl};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.HereNowCloudCore=api;
})(typeof window==='undefined'?null:window);
