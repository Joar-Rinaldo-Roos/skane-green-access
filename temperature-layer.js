/* Here & Now: optional global forecast temperature layer on the MapLibre globe.
 * Loads Open-Meteo's MapLibre/OM protocol only when enabled.
 * Does not use GPS, Overpass, OpenAI, or a user-supplied API key. */
(function(){
  'use strict';
  const core=window.HereNowTemperatureCore;
  const toggle=document.getElementById('toggle-temperature');
  const status=document.getElementById('temperature-status');
  const info=document.getElementById('temperature-details');
  if(!core||!toggle||!status||!info)return;

  const PACKAGE='https://unpkg.com/@openmeteo/weather-map-layer@0.3.2/dist/index.mjs';
  let enabled=false,protocolReady=false,libraryPromise=null;
  let boundMap=null,forecastTime=null,readinessTimer=null,sourceLoaded=false;
  const log=message=>window.HereNowDiagnostics?.log('Temperature',message);
  function say(message){status.textContent=message;log(message);}
  function timeDescription(){
    if(!forecastTime)return 'Nearest forecast hour · actual model timestamp not yet confirmed';
    const parsed=new Date(forecastTime);
    return Number.isFinite(parsed.getTime())
      ?'Forecast valid '+parsed.toLocaleString(undefined,{timeZone:'UTC',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' UTC'
      :'Nearest forecast hour';
  }
  function setDetails(){
    info.hidden=!enabled;
    const time=document.getElementById('temperature-forecast-time');
    if(time)time.textContent=timeDescription();
  }
  async function loadProtocol(){
    if(protocolReady)return;
    if(!libraryPromise){
      libraryPromise=(async()=>{
        const module=await import(PACKAGE);
        if(typeof module.omProtocol!=='function')throw Error('Missing Open-Meteo MapLibre protocol');
        if(!window.maplibregl||typeof window.maplibregl.addProtocol!=='function')
          throw Error('MapLibre is still loading');
        window.maplibregl.addProtocol('om',module.omProtocol);
        protocolReady=true;
        log('Open-Meteo temperature protocol registered');
      })().catch(error=>{libraryPromise=null;throw error;});
    }
    await libraryPromise;
  }
  async function loadForecastTime(){
    // Metadata is optional: forecast rendering does not rely on this request.
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),10000);
    try{
      const result=await fetch(core.temperatureMetadataUrl(),{signal:controller.signal,cache:'no-store'});
      if(!result.ok)throw Error('model metadata HTTP '+result.status);
      const metadata=await result.json();
      forecastTime=core.selectForecastTime(metadata,new Date());
      setDetails();
      log(forecastTime?'Model time metadata resolved':'No valid forecast timestamps in model metadata');
    }catch(error){
      log('Model timestamp unavailable: '+(error?.message||'unknown'));
    }finally{clearTimeout(timer);}
  }
  function clearReadinessTimer(){
    if(readinessTimer!==null)clearTimeout(readinessTimer);
    readinessTimer=null;
  }
  function attachMapListeners(map){
    if(boundMap===map)return;
    boundMap=map;sourceLoaded=false;
    map.on('sourcedata',event=>{
      if(!enabled||event.sourceId!=='hn-temperature'||!event.isSourceLoaded)return;
      sourceLoaded=true;clearReadinessTimer();
      say('Temperature forecast source loaded. Explore the global colours as you rotate or zoom the globe. '+timeDescription()+'.');
    });
    map.on('error',event=>{
      if(!enabled)return;
      const message=String(event.error?.message||'');
      const id=String(event.sourceId||'');
      if(id==='hn-temperature'||/openmeteo|data_spatial|om_file|temperature/i.test(message)){
        log('Weather source error: '+message.slice(0,200));
        say('Temperature layer encountered a weather-data or rendering error. Check Diagnostics and try again.');
      }
    });
  }
  async function apply(){
    if(!enabled)return;
    const globe=window.HereNowGlobe;
    if(!globe?.isActive?.()){
      say('Temperature is available on the 3D globe. Switching to the globe…');
      const button=document.getElementById('toggle-globe');
      if(button)button.click();
    }
    const map=globe?.getMap?.();
    if(!map||!map.isStyleLoaded?.()){
      say('Opening the 3D globe; temperature will appear when the map is ready…');
      return;
    }
    if(!protocolReady){
      say('Loading the Open-Meteo weather renderer…');
      try{await loadProtocol();}
      catch(error){
        if(enabled)say('Could not load the weather renderer: '+(error?.message||'unknown error'));
        return;
      }
    }
    if(!enabled)return;
    if(!map.isStyleLoaded?.())return;
    try{
      attachMapListeners(map);
      if(!map.getSource('hn-temperature')){
        map.addSource('hn-temperature',core.temperatureSource());
        const before=map.getLayer('sgu-soil-fill')?'sgu-soil-fill':
          map.getLayer('hn-green-wood-tiles')?'hn-green-wood-tiles':undefined;
        map.addLayer(core.temperatureLayer(true),before);
        sourceLoaded=false;
        log('MapLibre global forecast temperature source added');
      }else if(map.getLayer('hn-temperature-raster')){
        map.setLayoutProperty('hn-temperature-raster','visibility','visible');
      }
      if(!sourceLoaded){
        say('Loading global 2 m air-temperature forecast… '+timeDescription()+'.');
        clearReadinessTimer();
        readinessTimer=setTimeout(()=>{
          readinessTimer=null;
          if(enabled&&!sourceLoaded)say('Temperature forecast is taking longer to load. Check your connection or Diagnostics.');
        },28000);
      }
    }catch(error){
      if(enabled)say('Temperature map layer could not start: '+(error?.message||'unknown error'));
      log('MapLibre layer error: '+(error?.message||'unknown error'));
    }
  }
  function hide(){
    clearReadinessTimer();
    const map=window.HereNowGlobe?.getMap?.();
    if(map?.getLayer?.('hn-temperature-raster')){
      try{map.setLayoutProperty('hn-temperature-raster','visibility','none');}
      catch(error){log('Unable to hide temperature layer: '+error.message);}
    }
    say('Temperature layer hidden.');
  }
  function onGlobeReady(){
    if(enabled)apply();
  }
  toggle.addEventListener('click',()=>{
    enabled=!enabled;
    // The two global weather palettes are alternatives, not competing overlays.
    if(enabled)window.HereNowRain?.hide?.();
    toggle.classList.toggle('layer-active',enabled);
    toggle.setAttribute('aria-pressed',String(enabled));
    toggle.setAttribute('aria-label',enabled?'Hide global temperature forecast':'Show global temperature forecast');
    setDetails();
    if(enabled){
      loadForecastTime();
      apply();
    }else hide();
  });
  window.addEventListener('here-now-globe-map-ready',onGlobeReady);
  window.HereNowTemperature={onGlobeReady,isEnabled:()=>enabled,ensureProtocol:loadProtocol};
})();
