/* Here & Now — DWD ICON global surface wind arrows on the MapLibre globe.
 * Drawn as vector line features by the Open-Meteo OM protocol (arrows=true).
 * Timeline changes represent successive model forecasts; no fake particle drift. */
(function(){
  'use strict';
  const core=window.HereNowWindCore;
  const button=document.getElementById('toggle-wind');
  const panel=document.getElementById('wind-forecast-controls');
  const status=document.getElementById('wind-status');
  const play=document.getElementById('wind-play');
  const slider=document.getElementById('wind-hour');
  const stamp=document.getElementById('wind-time-label');
  const lead=document.getElementById('wind-lead-time');
  const max=document.getElementById('wind-max-label');
  const model=document.getElementById('wind-model-time');
  if(!core||!button||!panel||!status||!play||!slider||!stamp||!lead||!max||!model)return;

  const INTERVAL_MS=4500;
  let enabled=false,frames=[],index=0,timer=null,sliderTimer=null,boundMap=null;
  let metadataPromise=null,metadataAt=0,initPromise=null,initSequence=-1,sequence=0;
  let displayedUrl='',loaded=false;
  const log=message=>window.HereNowDiagnostics?.log('Wind',message);
  const say=message=>{status.textContent=message;log(message);};
  function formatTime(frame){
    if(!frame||!Number.isFinite(frame.epoch))return 'time unavailable';
    return new Date(frame.epoch).toLocaleString(undefined,{
      weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZoneName:'short'
    });
  }
  function display(){
    const frame=frames[index];
    stamp.textContent=frame?'Forecast valid: '+formatTime(frame):'Loading wind forecast hours…';
    lead.textContent=frame?'+'+Math.max(0,Math.round(frame.offsetHours))+' h':'—';
    slider.value=String(index);
    play.disabled=!enabled||frames.length<=1;
  }
  function stop(){
    if(timer!==null){clearInterval(timer);timer=null;}
    play.textContent='▶ Play';
    play.setAttribute('aria-pressed','false');
  }
  function listen(map){
    if(boundMap===map)return;
    boundMap=map;
    map.on('sourcedata',event=>{
      if(!enabled||event.sourceId!=='hn-wind'||!event.isSourceLoaded)return;
      loaded=true;
      say('Surface wind arrows loaded for '+formatTime(frames[index])+'. Arrow tips point where air flows.');
    });
    map.on('error',event=>{
      if(!enabled||event.sourceId!=='hn-wind')return;
      say('Wind arrows could not load. Check Diagnostics and try Wind again.');
      log(String(event.error?.message||'wind vector source error').slice(0,200));
      stop();
    });
  }
  function setFrame(next,force=false){
    if(!enabled||!Number.isSafeInteger(next)||next<0||next>=frames.length)return;
    index=next;display();
    const map=window.HereNowGlobe?.getMap?.();
    if(!map||(!map.getSource?.('hn-wind')&&!map.isStyleLoaded?.()))return;
    const frame=frames[index],url=core.windUrl(frame);
    try{
      if(!map.getSource('hn-wind')){
        map.addSource('hn-wind',core.windSource(frame));
        // Wind arrows must be above temperature, clouds, rain and basemap.
        map.addLayer(core.windLayer(true));
        displayedUrl=url;
        listen(map);
      }else{
        if(map.getLayer('hn-wind-arrows')){
          map.setLayoutProperty('hn-wind-arrows','visibility','visible');
          map.setPaintProperty('hn-wind-arrows','line-opacity',0.88);
        }
        if(url!==displayedUrl){
          const source=map.getSource('hn-wind');
          if(!window.HereNowFirstFrames?.claim?.('wind',url)){
            if(typeof source.setUrl!=='function')throw Error('MapLibre cannot update wind forecast hours');
            source.setUrl(url);
          }
          displayedUrl=url;
        }
      }
      loaded=false;
      say('Loading forecast wind direction for '+formatTime(frame)+'…');
    }catch(error){
      say('Wind layer failed: '+String(error?.message||'unknown error'));
      stop();
    }
  }
  async function timeline(){
    if(metadataPromise&&Date.now()-metadataAt<5*60*1000)return metadataPromise;
    metadataAt=Date.now();
    metadataPromise=(async()=>{
      const abort=new AbortController();
      const timeout=setTimeout(()=>abort.abort(),14000);
      try{
        const metadata=window.HereNowWeatherData
          ?await window.HereNowWeatherData.getMetadata()
          :await (async()=>{
             const response=await fetch(core.metadataUrl(),{signal:abort.signal,cache:'no-store'});
             if(!response.ok)throw Error('Open-Meteo model metadata HTTP '+response.status);
             return response.json();
           })();
        return core.buildWindFrames(metadata,new Date(),48,3);
      }finally{clearTimeout(timeout);}
    })().catch(error=>{metadataPromise=null;metadataAt=0;throw error;});
    return metadataPromise;
  }
  async function setup(){
    if(!enabled)return;
    if(initPromise&&initSequence===sequence)return initPromise;
    const request=sequence;
    initSequence=request;
    const job=(async()=>{
      if(!window.HereNowGlobe?.isActive?.()){
        say('Opening the 3D globe for wind arrows…');
        document.getElementById('toggle-globe')?.click();
        return; // globe-ready event resumes after MapLibre is initialized
      }
      const map=window.HereNowGlobe?.getMap?.();
      if(!map||(!map.getSource?.('hn-wind')&&!map.isStyleLoaded?.())){
        say('Waiting for the 3D globe…');
        return;
      }
      say('Checking model wind vector forecast hours…');
      try{
        const [result]=await Promise.all([
          timeline(),window.HereNowTemperature?.ensureProtocol?.()||
            Promise.reject(Error('Open-Meteo renderer is unavailable'))
        ]);
        if(!enabled||request!==sequence)return;
        frames=result.frames;index=0;
        slider.max=String(frames.length-1);
        slider.disabled=frames.length<2;
        max.textContent='+'+Math.round(frames.at(-1).offsetHours)+' h';
        model.textContent='DWD ICON Global · 10 m wind · model issued '+
          (result.referenceTime?formatTime({epoch:Date.parse(result.referenceTime)}):'unknown')+
          ' · '+frames.length+' frames';
        display();
        listen(map);
        setFrame(0,true);
        window.HereNowWeatherTimeline?.syncLayer?.('wind');
      }catch(error){
        if(!enabled||request!==sequence)return;
        say('Wind forecast unavailable: '+String(error?.message||'unknown error')+'. Turn Wind off and on to retry.');
        slider.disabled=true;play.disabled=true;
      }
    })();
    initPromise=job.finally(()=>{if(initSequence===request)initPromise=null;});
    return initPromise;
  }
  function togglePlay(){
    if(!enabled||frames.length<2)return;
    if(timer!==null){stop();return;}
    if(core.nextWindFrame(index,frames.length)===null)setFrame(0);
    play.textContent='Ⅱ Pause';
    play.setAttribute('aria-pressed','true');
    timer=setInterval(()=>{
      const next=core.nextWindFrame(index,frames.length);
      if(next===null){stop();return;}
      setFrame(next);
    },INTERVAL_MS);
  }
  function hide(){
    if(!enabled)return;
    enabled=false;sequence++;
    stop();
    if(sliderTimer!==null){clearTimeout(sliderTimer);sliderTimer=null;}
    button.classList.remove('layer-active');
    button.setAttribute('aria-pressed','false');
    panel.hidden=true;
    const map=window.HereNowGlobe?.getMap?.();
    if(map?.getLayer?.('hn-wind-arrows')){
      try{map.setLayoutProperty('hn-wind-arrows','visibility','none');}
      catch(error){log('Unable to hide wind: '+error.message);}
    }
    say('Wind arrows hidden.');
  }
  play.addEventListener('click',togglePlay);
  slider.addEventListener('input',()=>{
    stop();
    const chosen=Number(slider.value);
    if(!Number.isSafeInteger(chosen)||chosen<0||chosen>=frames.length)return;
    index=chosen;display();
    if(sliderTimer!==null)clearTimeout(sliderTimer);
    sliderTimer=setTimeout(()=>{sliderTimer=null;setFrame(chosen);},280);
  });
  button.addEventListener('click',()=>{
    if(enabled){hide();return;}
    enabled=true;sequence++;
    button.classList.add('layer-active');
    button.setAttribute('aria-pressed','true');
    panel.hidden=false;slider.disabled=true;play.disabled=true;
    display();setup();
  });
  window.addEventListener('here-now-globe-map-ready',()=>{if(enabled)setup();});
  function setForecastFrame(frame){
    if(!enabled||!Number.isSafeInteger(frame?.index)||typeof frame.time!=='string'||!frames.length)return false;
    let pos=frames.findIndex(f=>f.index===frame.index);
    if(pos<0){pos=frames.length;frames.push(frame);}
    stop();
    setFrame(pos);
    return true;
  }
  window.HereNowWind={hide,isEnabled:()=>enabled,stopPlayback:stop,setForecastFrame};
})();
