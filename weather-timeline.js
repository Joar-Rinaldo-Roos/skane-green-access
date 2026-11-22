/* Here & Now v1.0.6: ONE Play/Pause + 48-hour forecast slider for
 * temperature, rain, clouds and wind. Uses a single DWD ICON model timeline.
 * Layer toggles control only visibility, not independent clocks. */
(function(){
  'use strict';
  const core=window.HereNowWeatherTimelineCore;
  const panel=document.getElementById('weather-timeline');
  const play=document.getElementById('weather-play');
  const slider=document.getElementById('weather-hour');
  const label=document.getElementById('weather-time-label');
  const progress=document.getElementById('weather-lead-time');
  const end=document.getElementById('weather-max-label');
  const model=document.getElementById('weather-model-time');
  const status=document.getElementById('weather-timeline-status');
  if(!core||!panel||!play||!slider||!label||!progress||!end||!model||!status)return;
  const INTERVAL_MS=4500;
  const layers=[
    ['temperature','HereNowTemperature'],
    ['rain','HereNowRain'],
    ['clouds','HereNowClouds'],
    ['wind','HereNowWind']
  ];
  let frames=[],index=0,playing=null,sliderTimer=null;
  let modelPromise=null,modelFetchedAt=0,fetchId=0;
  const log=msg=>window.HereNowDiagnostics?.log('Weather timeline',msg);
  const say=msg=>{status.textContent=msg;log(msg);};
  function active(){
    return layers.some(([,name])=>Boolean(window[name]?.isEnabled?.()));
  }
  function validStamp(frame){
    return frame&&Number.isFinite(frame.epoch)
      ?new Date(frame.epoch).toLocaleString(undefined,{
        weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZoneName:'short'
      }):'Forecast time unavailable';
  }
  function currentFrame(){return frames[index]||null;}
  function render(){
    const frame=currentFrame();
    label.textContent=frame?'Forecast valid: '+validStamp(frame):'Loading shared forecast hours…';
    progress.textContent=frame?'+'+Math.max(0,Math.round(frame.offsetHours))+' h':'—';
    slider.max=String(Math.max(0,frames.length-1));
    slider.value=String(index);
    slider.disabled=!active()||frames.length<=1;
    play.disabled=!active()||frames.length<=1;
    end.textContent=frames.length?'+'+Math.round(frames.at(-1).offsetHours)+' h':'+48 h';
  }
  function stop(){
    if(playing!==null){clearInterval(playing);playing=null;}
    play.textContent='▶ Play';
    play.setAttribute('aria-pressed','false');
  }
  function updateActiveLayers(frame){
    if(!frame)return;
    // All layers receive the exact same model index and UTC valid time.
    // Inactive layers are not fetched or rendered.
    if(window.HereNowRain?.isEnabled?.())
      window.HereNowRain.setForecastFrame?.(frame);
    if(window.HereNowClouds?.isEnabled?.())
      window.HereNowClouds.setForecastFrame?.(frame);
    if(window.HereNowWind?.isEnabled?.())
      window.HereNowWind.setForecastFrame?.(frame);
    if(window.HereNowTemperature?.isEnabled?.())
      window.HereNowTemperature.setForecastFrame?.(frame);
  }
  function setIndex(next){
    if(!Number.isSafeInteger(next)||next<0||next>=frames.length)return;
    index=next;
    render();
    updateActiveLayers(currentFrame());
    say('All enabled weather layers show '+validStamp(currentFrame())+' from the same DWD ICON forecast hour.');
  }
  async function loadTimeline(){
    if(modelPromise&&Date.now()-modelFetchedAt<5*60*1000)return modelPromise;
    modelFetchedAt=Date.now();
    const id=++fetchId;
    modelPromise=(async()=>{
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),14000);
      try{
        const metadata=window.HereNowWeatherData
          ?await window.HereNowWeatherData.getMetadata()
          :await (async()=>{
             const response=await fetch(core.metadataUrl(),{signal:controller.signal,cache:'no-store'});
             if(!response.ok)throw Error('DWD ICON model metadata HTTP '+response.status);
             return response.json();
           })();
        const result=core.buildTimeline(metadata,new Date(),48,3);
        if(id===fetchId){
          // Preserve the previous frame index where possible during metadata refresh.
          const old=currentFrame();
          frames=result.frames;
          const match=old?frames.findIndex(f=>f.time===old.time):-1;
          index=match>=0?match:0;
          model.textContent='One DWD ICON Global forecast · run issued '+
            (result.referenceTime?validStamp({epoch:Date.parse(result.referenceTime)}):'time unavailable')+
            ' · '+frames.length+' frames';
          render();
          updateActiveLayers(currentFrame());
          say('Shared forecast ready. Select layers and press Play to animate all of them together.');
        }
        return result;
      }finally{clearTimeout(timeout);}
    })().catch(error=>{if(id===fetchId){modelPromise=null;modelFetchedAt=0;}throw error;});
    return modelPromise;
  }
  async function activate(){
    panel.hidden=!active();
    if(!active()){stop();render();return;}
    render();
    if(frames.length){
      updateActiveLayers(currentFrame());
      return;
    }
    say('Loading one shared weather forecast timeline…');
    try{await loadTimeline();}
    catch(error){
      if(active())say('Shared weather timeline unavailable: '+String(error?.message||'network error')+'. Toggle a layer to retry.');
      log('Shared timeline setup error: '+String(error?.message||error));
    }
  }
  function syncLayer(name){
    const layer=layers.find(([label])=>label===name);
    if(!layer||!window[layer[1]]?.isEnabled?.())return;
    const frame=currentFrame();
    if(frame){
      window[layer[1]]?.setForecastFrame?.(frame);
    }else activate();
  }
  function togglePlay(){
    if(!active()||frames.length<2)return;
    if(playing!==null){stop();return;}
    if(core.nextFrame(index,frames.length)===null)setIndex(0);
    play.textContent='Ⅱ Pause';
    play.setAttribute('aria-pressed','true');
    playing=setInterval(()=>{
      const next=core.nextFrame(index,frames.length);
      if(next===null){stop();return;}
      setIndex(next);
    },INTERVAL_MS);
  }
  play.addEventListener('click',togglePlay);
  slider.addEventListener('input',()=>{
    stop();
    const next=Number(slider.value);
    if(!Number.isSafeInteger(next)||next<0||next>=frames.length)return;
    index=next;
    render();
    if(sliderTimer!==null)clearTimeout(sliderTimer);
    sliderTimer=setTimeout(()=>{sliderTimer=null;setIndex(next);},260);
  });
  for(const id of ['toggle-temperature','toggle-rain','toggle-clouds','toggle-wind']){
    document.getElementById(id)?.addEventListener('click',activate);
  }
  document.getElementById('cloud-with-temperature')?.addEventListener('change',activate);
  window.HereNowWeatherTimeline={
    activate,syncLayer,currentFrame,isPlaying:()=>playing!==null,
    setIndex,stop,frameCount:()=>frames.length
  };
  render();
})();
