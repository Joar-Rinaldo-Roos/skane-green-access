/* Here & Now v1.0.2 — next measurable rain at visible map center (no GPS).
 * Distinct from the animated global rain forecast: uses Open-Meteo's best-match
 * local hourly model, with 2m radar NOT implied. */
(function(){
  'use strict';
  const core=window.HereNowNextRainCore;
  const panel=document.getElementById('next-rain-panel');
  const button=document.getElementById('next-rain-refresh');
  const headline=document.getElementById('next-rain-headline');
  const detail=document.getElementById('next-rain-detail');
  const status=document.getElementById('next-rain-status');
  const place=document.getElementById('next-rain-place');
  if(!core||!panel||!button||!headline||!detail||!status||!place)return;

  let lastPoint=null,controller=null,requestId=0,stale=false;
  const log=message=>window.HereNowDiagnostics?.log('Next rain',message);
  function currentCenter(){
    const center=window.HereNowMap?.getView?.();
    return center&&Number.isFinite(center.lat)&&Number.isFinite(center.lon)
      ?{lat:center.lat,lon:center.lon}:null;
  }
  function setStatus(message){
    status.textContent=message;
    log(message);
  }
  function setLoading(loading){
    button.disabled=loading;
    button.textContent=loading?'Checking…':'↻ Update forecast';
  }
  function changeMapCenter(){
    const center=currentCenter();
    if(!center||!lastPoint)return;
    if(Math.abs(center.lat-lastPoint.lat)<0.001&&Math.abs(center.lon-lastPoint.lon)<0.001)return;
    if(controller){controller.abort();controller=null;requestId++;setLoading(false);}
    if(!stale){
      stale=true;
      headline.textContent='Map moved — update forecast';
      detail.textContent='Tap Update forecast to check when rain is predicted at the new map center.';
      setStatus('The earlier forecast belonged to a different location.');
    }
    place.textContent='Map center · '+core.coordinateLabel(center);
  }
  async function refresh(){
    const center=currentCenter();
    if(!center){
      headline.textContent='Map not ready';
      detail.textContent='Try again once the street map or globe has loaded.';
      setStatus('Map center unavailable.');
      return;
    }
    if(controller)controller.abort();
    const id=++requestId;
    const abort=new AbortController();
    controller=abort;
    lastPoint=center;stale=false;
    place.textContent='Map center · '+core.coordinateLabel(center);
    setLoading(true);
    headline.textContent='Checking the next 48 hours…';
    detail.textContent='Reading the forecast for the visible map center (GPS not required).';
    setStatus('Fetching Open-Meteo hourly rain and showers forecast…');
    const timer=setTimeout(()=>abort.abort(),18000);
    try{
      const response=await fetch(core.forecastUrl(center),{
        signal:abort.signal,headers:{Accept:'application/json'}
      });
      if(!response.ok)throw Error('Open-Meteo HTTP '+response.status);
      const data=await response.json();
      if(id!==requestId||stale)return;
      if(data?.error)throw Error('Open-Meteo: '+String(data.reason||'forecast unavailable').slice(0,150));
      const result=core.findNextRain(data,new Date());
      if(result.kind==='rain'){
        const interval=core.formatRainWindow(result.start,result.end);
        headline.textContent=result.ongoing?'🌧️ Rain forecast this hour':'🌧️ Next rain: '+interval;
        detail.textContent=(result.ongoing?'Expected during ':'Forecast rain during ')+interval+
          ' · about '+result.amountMm.toFixed(1)+' mm rain/showers in that hour.'+
          (result.probability!==null?' Chance of any precipitation: '+result.probability+'%.':'');
        setStatus('Model forecast · amounts and timing are estimates, not live radar.');
      }else if(result.kind==='dry'){
        headline.textContent='☀️ No measurable rain expected in available 48-hour forecast';
        detail.textContent='The model does not show an hour with at least '+
          result.thresholdMm.toFixed(1)+' mm of rain or showers here. Drizzle, snow and forecast uncertainty remain possible.';
        setStatus('Forecast checked. Changes in the weather model may alter this result.');
      }else{
        headline.textContent='No usable hourly rain forecast';
        detail.textContent='Open-Meteo returned no valid rain/showers hourly values for this map center. Try again later.';
        setStatus('Hourly rainfall values unavailable.');
      }
    }catch(error){
      if(id!==requestId||stale)return;
      headline.textContent='Rain forecast unavailable';
      detail.textContent='Could not fetch the hourly forecast. Try Update forecast again.';
      setStatus(error.name==='AbortError'?'Forecast request timed out.':String(error?.message||'Network error').slice(0,160));
    }finally{
      clearTimeout(timer);
      if(id===requestId){controller=null;setLoading(false);}
    }
  }
  button.addEventListener('click',refresh);
  window.HereNowNextRain={refresh,onMapMoved:changeMapCenter};
  // Leaflet is already initialized before this deferred module. Initial map center
  // defaults to Lund, but the user can move either map and refresh at the new center.
  refresh();
})();
