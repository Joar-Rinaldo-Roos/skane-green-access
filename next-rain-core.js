/* Here & Now: next expected liquid-rain hour from Open-Meteo's location forecast.
 * Use the CENTER OF THE ACTIVE MAP, never GPS by default.
 * Hourly "rain" and "showers" are distinct variables; both are counted.
 * Values are forecasts, not observations, and do not guarantee rainfall. */
(function(root){
  'use strict';
  const ENDPOINT='https://api.open-meteo.com/v1/forecast';
  const THRESHOLD_MM=0.2;
  const HORIZON_MS=48*3600000;
  function validPoint(point){
    return Number.isFinite(point?.lat)&&Number.isFinite(point?.lon)&&
      Math.abs(point.lat)<=90&&Math.abs(point.lon)<=180;
  }
  function forecastUrl(point){
    if(!validPoint(point))throw Error('Invalid map center coordinates');
    const params=new URLSearchParams({
      latitude:point.lat.toFixed(5),longitude:point.lon.toFixed(5),
      hourly:'rain,showers,precipitation_probability',
      forecast_hours:'48',timezone:'UTC',precipitation_unit:'mm',
      models:'best_match'
    });
    return ENDPOINT+'?'+params.toString();
  }
  function parseUtcHour(raw){
    if(typeof raw!=='string')return null;
    let text=raw;
    if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(text))text+='Z';
    else if(!/Z$|[+-]\d{2}:\d{2}$/.test(text))return null;
    const millis=Date.parse(text);
    return Number.isFinite(millis)?new Date(millis):null;
  }
  function findNextRain(data,now=new Date(),thresholdMm=THRESHOLD_MM){
    const empty={kind:'unavailable',thresholdMm};
    const hourly=data?.hourly;
    const times=hourly?.time;
    const rain=hourly?.rain,showers=hourly?.showers;
    const probability=hourly?.precipitation_probability;
    const nowMillis=now instanceof Date?now.getTime():new Date(now).getTime();
    if(!Array.isArray(times)||!times.length||
      (!Array.isArray(rain)&&!Array.isArray(showers))||
      !Number.isFinite(nowMillis)||!Number.isFinite(thresholdMm)||thresholdMm<=0)return empty;
    let measured=0,peakProbability=null;
    for(let i=0;i<times.length;i++){
      const end=parseUtcHour(times[i]);
      if(!end)continue;
      const endMs=end.getTime();
      if(endMs<=nowMillis||endMs>nowMillis+HORIZON_MS)continue;
      const a=Array.isArray(rain)?rain[i]:null;
      const b=Array.isArray(showers)?showers[i]:null;
      const hasRain=typeof a==='number'&&Number.isFinite(a)&&a>=0;
      const hasShower=typeof b==='number'&&Number.isFinite(b)&&b>=0;
      if(!hasRain&&!hasShower)continue;
      measured++;
      const value=Math.round(((hasRain?a:0)+(hasShower?b:0))*100)/100;
      const chance=Array.isArray(probability)?probability[i]:null;
      const percent=typeof chance==='number'&&Number.isFinite(chance)&&chance>=0&&chance<=100?chance:null;
      if(percent!==null)peakProbability=Math.max(peakProbability??0,percent);
      if(value+1e-9>=thresholdMm){
        const start=new Date(endMs-3600000);
        return {kind:'rain',start,end,ongoing:start.getTime()<=nowMillis,
          amountMm:value,probability:percent,thresholdMm,model:'Open-Meteo Best Match'};
      }
    }
    if(!measured)return empty;
    return {kind:'dry',thresholdMm,maxProbability:peakProbability,model:'Open-Meteo Best Match'};
  }
  function coordinateLabel(point){
    if(!validPoint(point))throw Error('Invalid map center coordinates');
    const lat=Math.abs(point.lat).toFixed(2)+'°'+(point.lat<0?'S':'N');
    const lon=Math.abs(point.lon).toFixed(2)+'°'+(point.lon<0?'W':'E');
    return lat+', '+lon;
  }
  function formatRainWindow(start,end,timeZone){
    const options={day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false};
    if(timeZone)options.timeZone=timeZone;
    const head=new Intl.DateTimeFormat('en-GB',options).format(start);
    const tail=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,
      ...(timeZone?{timeZone}:{})}).format(end);
    return head+'–'+tail;
  }
  const api={forecastUrl,findNextRain,formatRainWindow,coordinateLabel,parseUtcHour,thresholdMm:THRESHOLD_MM};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.HereNowNextRainCore=api;
})(typeof window==='undefined'?null:window);
