/* Here & Now v1.0.9 — bounded next-frame viewport weather preloading.
 * MapLibre has no supported API to populate arbitrary decoded tile IDs directly.
 * Instead a single almost-transparent raster/vector layer requests the NEXT
 * model frame using the official Open-Meteo OM protocol, at max tile zoom 5.
 * This may warm its worker/HTTP cache and reduce later loading, but does not
 * guarantee MapLibre will reuse the rendered tiles of the visible source.
 * At most one extra source/frame is present, and Data Saver / 2G are respected.
 */
(function(root){
  'use strict';
  const SOURCE_ID='hn-weather-next-prefetch';
  const LAYER_ID='hn-weather-next-prefetch-layer';
  const TILE_ZOOM=5;
  const SCHEDULE_DELAY_MS=350;
  const PRIORITY=[
    ['clouds','HereNowClouds','HereNowCloudCore','cloudSource','cloudLayer'],
    ['rain','HereNowRain','HereNowRainCore','rainSource','rainLayer'],
    ['temperature','HereNowTemperature','HereNowTemperatureCore','temperatureSource','temperatureLayer'],
    ['wind','HereNowWind','HereNowWindCore','windSource','windLayer']
  ];
  function chooseLayer(win){
    for(const [key,enabled,coreName,sourceBuilder] of PRIORITY){
      if(!win[enabled]?.isEnabled?.()||typeof win[coreName]?.[sourceBuilder]!=='function')continue;
      return {key,source:win[coreName][sourceBuilder]};
    }
    return null;
  }
  function nextFrame(frames,index){
    if(!Array.isArray(frames)||!Number.isSafeInteger(index)||index<0||
       index>=frames.length-1)return null;
    return frames[index+1]||null;
  }
  function buildSource(choice,frame){
    if(!choice||!Number.isSafeInteger(frame?.index)||frame.index<0)return null;
    const source=choice.source(frame);
    if(!source||!['raster','vector'].includes(source.type)||typeof source.url!=='string'||
       !source.url.startsWith('om://'))return null;
    return {...source,maxzoom:Math.min(TILE_ZOOM,source.maxzoom||TILE_ZOOM)};
  }
  function buildLayer(source){
    const shared={id:LAYER_ID,source:SOURCE_ID,layout:{visibility:'visible'}};
    if(source.type==='vector'){
      return {...shared,type:'line','source-layer':'wind-arrows',
        paint:{'line-opacity':0.002,'line-width':0.5,'line-color':'#112233'}};
    }
    return {...shared,type:'raster',paint:{'raster-opacity':0.002,'raster-fade-duration':0}};
  }
  function allowed(win){
    const network=win.navigator?.connection;
    if(network?.saveData||network?.effectiveType==='slow-2g'||network?.effectiveType==='2g')return false;
    return true;
  }
  function insertBefore(map){
    for(const id of ['hn-temperature-raster','hn-rain-raster','hn-clouds-raster',
                      'hn-wind-arrows','sgu-soil-fill','hn-green-wood-tiles']){
      if(map.getLayer(id))return id;
    }
    return undefined;
  }
  const helpers={chooseLayer,nextFrame,buildSource,buildLayer,allowed,TILE_ZOOM,SOURCE_ID,LAYER_ID};
  if(typeof module!=='undefined'&&module.exports)module.exports=helpers;
  if(!root||!root.document)return;
  let pending=null,currentUrl='',currentType='',mapBound=null,enabled=true;
  const status=root.document.getElementById('weather-prefetch-status');
  const say=msg=>{if(status)status.textContent=msg;};
  const log=msg=>root.HereNowDiagnostics?.log('Weather prefetch',msg);
  function clear(){
    if(pending!==null){clearTimeout(pending);pending=null;}
    const map=root.HereNowGlobe?.getMap?.();
    if(map?.getLayer?.(LAYER_ID)){
      try{map.setLayoutProperty(LAYER_ID,'visibility','none');}
      catch(error){log('Could not hide next-frame preview: '+error.message);}
    }
  }
  function showNext(frames,index){
    pending=null;
    if(!enabled||!allowed(root)){clear();say('Next-frame preloading paused to save data.');return;}
    const frame=nextFrame(frames,index);
    const choice=chooseLayer(root);
    if(!frame||!choice){clear();say(frame?'No supported layer to preload.':'End of forecast timeline.');return;}
    const map=root.HereNowGlobe?.getMap?.();
    if(!map?.isStyleLoaded?.())return;
    const source=buildSource(choice,frame);
    if(!source)return;
    try{
      if(mapBound!==map){mapBound=map;currentUrl='';currentType='';}
      const current=map.getSource(SOURCE_ID);
      if(current&&currentType!==source.type){
        if(map.getLayer(LAYER_ID))map.removeLayer(LAYER_ID);
        map.removeSource(SOURCE_ID);
        currentUrl='';currentType='';
      }
      const present=map.getSource(SOURCE_ID);
      if(!present){
        map.addSource(SOURCE_ID,source);
        map.addLayer(buildLayer(source),insertBefore(map));
        currentType=source.type;
        currentUrl=source.url;
      }else{
        if(!map.getLayer(LAYER_ID))map.addLayer(buildLayer(source),insertBefore(map));
        map.setLayoutProperty(LAYER_ID,'visibility','visible');
        if(source.url!==currentUrl){
          if(typeof present.setUrl!=='function')throw Error('Forecast prefetch source cannot change frames');
          present.setUrl(source.url);
          currentUrl=source.url;
        }
      }
      say('Preloading next '+choice.key+' forecast frame for this globe view…');
    }catch(error){
      log('Next-frame preloading unavailable: '+String(error?.message||error));
      say('Next-frame preloading unavailable; regular weather loading still works.');
    }
  }
  function schedule(frames,index){
    if(pending!==null)clearTimeout(pending);
    if(!enabled)return;
    pending=setTimeout(()=>showNext(frames,index),SCHEDULE_DELAY_MS);
  }
  function setEnabled(on){
    enabled=Boolean(on);
    if(!enabled)clear();
  }
  root.HereNowWeatherPrefetch={schedule,clear,setEnabled};
  root.addEventListener?.('here-now-globe-map-ready',()=>{mapBound=null;currentUrl='';currentType='';});
})(typeof window==='undefined'?null:window);
