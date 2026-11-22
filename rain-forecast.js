/* Here & Now v1.0.1 — Global precipitation forecast / 48-hour animation.
 * Uses actual forecast time indices from DWD ICON metadata via Open-Meteo.
 * This is predictive model output (rain/snow), NOT an observed precipitation radar.
 * Precipitation and temperature are mutually exclusive to keep colours readable. */
(function(){
  'use strict';
  const core=window.HereNowRainCore;
  const button=document.getElementById('toggle-rain');
  const panel=document.getElementById('rain-forecast-controls');
  const status=document.getElementById('rain-status');
  const playButton=document.getElementById('rain-play');
  const slider=document.getElementById('rain-hour');
  const stamp=document.getElementById('rain-time-label');
  const progress=document.getElementById('rain-lead-time');
  const maxLabel=document.getElementById('rain-max-label');
  const modelLabel=document.getElementById('rain-model-time');
  if(!core||!button||!panel||!status||!playButton||!slider||!stamp||!progress||!maxLabel||!modelLabel)return;

  const INTERVAL_MS=4500;
  let enabled=false,frames=[],variable='precipitation',index=0;
  let setupPending=null,setupSequence=-1,metadataPending=null,metadataFetchedAt=0,playTimer=null,sliderTimer=null;
  let sequence=0,boundMap=null,frameLoadPending=false,sourceLoaded=false;
  let lastDisplayedUrl='';
  const log=message=>window.HereNowDiagnostics?.log('Rain forecast',message);
  const say=message=>{status.textContent=message;log(message);};
  function validStamp(frame){
    if(!frame)return 'Forecast time unavailable';
    const date=new Date(frame.epoch);
    if(!Number.isFinite(date.getTime()))return 'Forecast time unavailable';
    return date.toLocaleString(undefined,{
      weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZoneName:'short'
    });
  }
  function displayFrame(){
    const frame=frames[index];
    stamp.textContent=frame?'Forecast valid: '+validStamp(frame):'Loading model forecast times…';
    progress.textContent=frame?'+'+Math.max(0,Math.round(frame.offsetHours))+' h':'—';
    slider.value=String(index);
    playButton.disabled=!enabled||frames.length<=1;
  }
  function stopPlayback(){
    if(playTimer!==null){clearInterval(playTimer);playTimer=null;}
    playButton.textContent='▶ Play';
    playButton.setAttribute('aria-pressed','false');
  }
  function attachEvents(map){
    if(boundMap===map)return;
    boundMap=map;
    map.on('sourcedata',event=>{
      if(!enabled||event.sourceId!=='hn-rain'||!event.isSourceLoaded)return;
      sourceLoaded=true;frameLoadPending=false;
      say('Precipitation forecast loaded for '+validStamp(frames[index])+'. Move the timeline or press Play.');
    });
    map.on('error',event=>{
      if(!enabled)return;
      const name=String(event.sourceId||''),message=String(event.error?.message||'');
      if(name==='hn-rain'||/dwd_icon|openmeteo|precipitation|om_file/i.test(message)){
        log('Weather tile error: '+message.slice(0,200));
        say('Precipitation map failed to load. Check Diagnostics or retry the forecast.');
        stopPlayback();
      }
    });
  }
  function useFrame(newIndex,force=false){
    if(!enabled||!frames.length||!Number.isSafeInteger(newIndex)||
       newIndex<0||newIndex>=frames.length)return;
    index=newIndex;
    displayFrame();
    const map=window.HereNowGlobe?.getMap?.();
    if(!map||!map.isStyleLoaded?.())return;
    const frame=frames[index];
    const url=core.rainUrl(frame,variable);
    try{
      if(!map.getSource('hn-rain')){
        map.addSource('hn-rain',core.rainSource(frame,variable));
        const before=map.getLayer('sgu-soil-fill')?'sgu-soil-fill':
          map.getLayer('hn-green-wood-tiles')?'hn-green-wood-tiles':
          map.getLayer('hn-temperature-raster')?'hn-temperature-raster':undefined;
        map.addLayer(core.rainLayer(true),before);
        attachEvents(map);
        lastDisplayedUrl=url;
      }else{
        if(map.getLayer('hn-rain-raster'))
          map.setLayoutProperty('hn-rain-raster','visibility','visible');
        if(force||lastDisplayedUrl!==url){
          const source=map.getSource('hn-rain');
          if(typeof source.setUrl!=='function')throw Error('This MapLibre version cannot update weather raster time steps');
          source.setUrl(url);
          lastDisplayedUrl=url;
        }
      }
      sourceLoaded=false;frameLoadPending=true;
      say('Loading forecast precipitation for '+validStamp(frame)+'…');
    }catch(error){
      say('Cannot display this precipitation frame: '+(error?.message||'unknown error'));
      log('Map layer update error: '+(error?.message||'unknown error'));
      stopPlayback();
    }
  }
  async function loadModel(){
    if(metadataPending&&Date.now()-metadataFetchedAt<5*60*1000)return metadataPending;
    metadataFetchedAt=Date.now();
    metadataPending=(async()=>{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),14000);
      try{
        const response=await fetch(core.metadataUrl(),{signal:controller.signal,cache:'no-store'});
        if(!response.ok)throw Error('Open-Meteo model metadata HTTP '+response.status);
        const metadata=await response.json();
        return core.buildRainFrames(metadata,new Date(),48,3);
      }finally{clearTimeout(timer);}
    })().catch(error=>{metadataPending=null;metadataFetchedAt=0;throw error;});
    return metadataPending;
  }
  async function setup(){
    if(!enabled)return;
    if(setupPending&&setupSequence===sequence)return setupPending;
    const mySequence=sequence;
    setupSequence=mySequence;
    const thisSetup=(async()=>{
      if(!window.HereNowGlobe?.isActive?.()){
        say('Switching to the 3D globe for the rain forecast…');
        document.getElementById('toggle-globe')?.click();
        // The globe-ready event resumes setup after the map becomes usable.
        return;
      }
      const map=window.HereNowGlobe?.getMap?.();
      if(!map||!map.isStyleLoaded?.()){
        say('Waiting for the 3D globe to become ready…');
        return;
      }
      say('Checking available precipitation forecast hours…');
      try{
        // Reuse the temperature layer's existing OM protocol registration.
        const [timeline]=await Promise.all([
          loadModel(),window.HereNowTemperature?.ensureProtocol?.()||
            Promise.reject(Error('Open-Meteo weather renderer is unavailable'))
        ]);
        if(!enabled||mySequence!==sequence)return;
        frames=timeline.frames;variable=timeline.variable;
        index=0;sourceLoaded=false;
        slider.max=String(frames.length-1);
        slider.disabled=frames.length<2;
        maxLabel.textContent='+'+Math.round(frames[frames.length-1].offsetHours)+' h';
        modelLabel.textContent='DWD ICON Global · model issued '+
          (timeline.referenceTime?validStamp({epoch:Date.parse(timeline.referenceTime)}):'time unavailable')+
          ' · '+frames.length+' frames';
        displayFrame();
        attachEvents(map);
        useFrame(index,true);
      }catch(error){
        if(!enabled||mySequence!==sequence)return;
        say('Rain forecast unavailable: '+(error?.message||'unknown error')+'. Try turning Rain off and on again.');
        slider.disabled=true;playButton.disabled=true;
        log('Forecast initialization error: '+(error?.message||'unknown error'));
      }
    })();
    setupPending=thisSetup.finally(()=>{if(setupSequence===mySequence)setupPending=null;});
    return setupPending;
  }
  function startPlayback(){
    if(!enabled||frames.length<2)return;
    if(playTimer!==null){stopPlayback();return;}
    if(core.nextFrameIndex(index,frames.length)===null)useFrame(0);
    playButton.textContent='Ⅱ Pause';
    playButton.setAttribute('aria-pressed','true');
    playTimer=setInterval(()=>{
      const next=core.nextFrameIndex(index,frames.length);
      if(next===null){stopPlayback();return;}
      useFrame(next);
    },INTERVAL_MS);
  }
  function hide(){
    if(!enabled)return;
    enabled=false;sequence++;
    stopPlayback();
    if(sliderTimer!==null){clearTimeout(sliderTimer);sliderTimer=null;}
    button.classList.remove('layer-active');
    button.setAttribute('aria-pressed','false');
    button.setAttribute('aria-label','Show global precipitation forecast');
    panel.hidden=true;
    const map=window.HereNowGlobe?.getMap?.();
    if(map?.getLayer?.('hn-rain-raster')){
      try{map.setLayoutProperty('hn-rain-raster','visibility','none');}
      catch(error){log('Unable to hide rain layer: '+error.message);}
    }
    say('Rain forecast hidden.');
  }
  playButton.addEventListener('click',startPlayback);
  slider.addEventListener('input',()=>{
    stopPlayback();
    const chosen=Number(slider.value);
    if(!Number.isSafeInteger(chosen)||chosen<0||chosen>=frames.length)return;
    index=chosen;displayFrame();
    if(sliderTimer!==null)clearTimeout(sliderTimer);
    sliderTimer=setTimeout(()=>{sliderTimer=null;useFrame(chosen);},280);
  });
  button.addEventListener('click',()=>{
    if(enabled){hide();return;}
    enabled=true;sequence++;
    button.classList.add('layer-active');
    button.setAttribute('aria-pressed','true');
    button.setAttribute('aria-label','Hide global precipitation forecast');
    panel.hidden=false;slider.disabled=true;playButton.disabled=true;
    displayFrame();
    // Disable Temperature first so hiding Clouds does not briefly reload today's tiles.
    if(window.HereNowTemperature?.isEnabled?.())
      document.getElementById('toggle-temperature')?.click();
    window.HereNowClouds?.hide?.();
    setup();
  });
  window.addEventListener('here-now-globe-map-ready',()=>{if(enabled)setup();});
  window.HereNowRain={hide,isEnabled:()=>enabled,stopPlayback};
})();
