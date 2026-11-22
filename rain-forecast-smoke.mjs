/* Live network check of model metadata. Tests actual available forecast times and
 * precipitation variables; does not claim to render MapLibre on Android. */
const endpoint='https://openmeteo.s3.amazonaws.com/data_spatial/dwd_icon/latest.json';
const controller=new AbortController();
const timer=setTimeout(()=>controller.abort(),20000);
try{
  const response=await fetch(endpoint,{signal:controller.signal,cache:'no-store'});
  if(!response.ok)throw Error('Open-Meteo global metadata returned HTTP '+response.status);
  const data=await response.json();
  if(!Array.isArray(data.variables)||!data.variables.some(x=>x==='precipitation'||x==='rain'))
    throw Error('No precipitation or rain variable in current DWD ICON global run');
  if(!Array.isArray(data.valid_times)||data.valid_times.length<8)
    throw Error('DWD ICON did not publish enough valid forecast times');
  const now=Date.now(),times=data.valid_times.map(Date.parse).filter(Number.isFinite);
  const future=times.filter(t=>t>=now-3600000&&t<=now+48*3600000);
  const horizon=Math.max(...future)-now;
  if(future.length<8||horizon<36*3600000)throw Error('Current model has insufficient future coverage for a meaningful forecast animation');
  console.log('Live DWD ICON Global metadata verified: '+future.length+
    ' valid times in 48h, '+(horizon/3600000).toFixed(1)+'h forecast horizon, variable '+
    (data.variables.includes('precipitation')?'precipitation':'rain')+
    '; model reference '+String(data.reference_time||'unknown'));
}finally{clearTimeout(timer);}
