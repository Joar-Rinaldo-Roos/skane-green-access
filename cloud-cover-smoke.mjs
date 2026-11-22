/* GitHub CI checks the real current global cloud cover forecast feed.
 * Does not inspect user location or claim to validate Android WebGL rendering. */
const url='https://openmeteo.s3.amazonaws.com/data_spatial/dwd_icon/latest.json';
const controller=new AbortController();
const timeout=setTimeout(()=>controller.abort(),20000);
try{
  const response=await fetch(url,{signal:controller.signal,cache:'no-store'});
  if(!response.ok)throw Error('Open-Meteo model metadata HTTP '+response.status);
  const data=await response.json();
  if(!Array.isArray(data.variables)||!data.variables.includes('cloud_cover'))
    throw Error('DWD ICON global model metadata does not publish cloud_cover');
  if(!Array.isArray(data.valid_times)||data.valid_times.length<8)
    throw Error('Insufficient global cloud-cover forecast times');
  const now=Date.now();
  const valid=data.valid_times.map(value=>Date.parse(value)).filter(Number.isFinite);
  const future=valid.filter(time=>time>=now-3600000&&time<=now+48*3600000);
  if(future.length<8||Math.max(...future)-now<36*3600000)
    throw Error('Fewer than 36 forecast hours available for cloud cover');
  console.log('Open-Meteo global cloud_cover confirmed: '+future.length+
    ' valid hours within 48h; model run '+String(data.reference_time||'unreported')+
    '; last valid future hour '+new Date(Math.max(...future)).toISOString());
}finally{
  clearTimeout(timeout);
}
