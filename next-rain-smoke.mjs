/* Network integration smoke check — public example map center in Lund, Sweden.
 * No user's current location, private coordinates, or GPS are involved.
 * A valid forecast may have zero rain, which is not a test failure. */
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {forecastUrl,findNextRain}=require('./next-rain-core.js');
const url=forecastUrl({lat:55.7047,lon:13.1910});
const controller=new AbortController();
const timer=setTimeout(()=>controller.abort(),20000);
try{
 const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
 if(!response.ok)throw Error('Open-Meteo hourly forecast HTTP '+response.status);
 const data=await response.json();
 if(data.error)throw Error('Forecast provider error: '+String(data.reason||'unknown'));
 const times=data?.hourly?.time||[];
 const rain=data?.hourly?.rain||[];
 const showers=data?.hourly?.showers||[];
 if(times.length<24||times.length!==rain.length||times.length!==showers.length)
   throw Error('Missing or mismatched hourly time, rain and showers arrays');
 if(data?.hourly_units?.rain!=='mm'||data?.hourly_units?.showers!=='mm')
   throw Error('Unexpected hourly precipitation units');
 const result=findNextRain(data,new Date());
 if(result.kind==='unavailable')throw Error('No usable forward-looking hourly rain amounts');
 console.log('Open-Meteo hourly API verified: '+times.length+' hours, units in mm, forecast result '+result.kind);
}catch(error){
 console.error('Open-Meteo hourly forecast integration failed: '+(error?.message||error));
 throw error;
}finally{clearTimeout(timer);}
