'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const core=require('./first-frame-preload.js');
const temperature=require('./temperature-core.js');
const rain=require('./rain-forecast-core.js');
const clouds=require('./cloud-cover-core.js');
const wind=require('./wind-core.js');
const timeline=require('./weather-timeline-core.js');
const script=fs.readFileSync('first-frame-preload.js','utf8');
const modelTimes=Array.from({length:75},(_,i)=>new Date(Date.now()-3600000+i*3600000).toISOString());
const metadata={variables:['temperature_2m','precipitation','cloud_cover','wind_u_component_10m','wind_v_component_10m'],
 valid_times:modelTimes,reference_time:new Date(Date.now()-6*3600000).toISOString()};
const cores={HereNowTemperatureCore:temperature,HereNowRainCore:rain,
 HereNowCloudCore:clouds,HereNowWindCore:wind,HereNowWeatherTimelineCore:timeline};
test('startup uses exact visible MapLibre source IDs and native full-resolution tiles',()=>{
 const frame=core.initialFrame(cores,metadata,new Date());
 const list=core.specs(cores,metadata,frame);
 assert.equal(list.length,4);
 assert.deepEqual(list.map(x=>x.sourceId),['hn-temperature','hn-rain','hn-clouds','hn-wind']);
 assert.deepEqual(list.map(x=>x.layerId),
   ['hn-temperature-raster','hn-rain-raster','hn-clouds-raster','hn-wind-arrows']);
 assert(list.every(x=>x.source.maxzoom===12));
 assert(list.every(x=>new URL(x.source.url.slice(5)).searchParams.get('time_step')==='valid_times_'+frame.index));
 assert(list.every(x=>core.prepLayer(x).paint[x.opacity]===0.002));
 assert(list.every(x=>core.prepLayer(x).layout.visibility==='visible'));
 assert.equal(list[3].source.type,'vector');
 assert.equal(list[3].layer['source-layer'],'wind-arrows');
});
test('only published model variables are warmed; missing wind V is not guessed',()=>{
 const frame=core.initialFrame(cores,metadata,new Date());
 assert.deepEqual(core.specs(cores,{...metadata,variables:['temperature_2m']},frame).map(s=>s.key),['temperature']);
 assert.equal(core.specs(cores,{...metadata,variables:['wind_u_component_10m']},frame).length,0);
 const rainOnly=core.specs(cores,{...metadata,variables:['rain']},frame);
 assert.equal(rainOnly.length,1);
 assert.match(rainOnly[0].source.url,/variable=rain/);
});
test('Save Data and 2g skip background but do not affect visible overlays',()=>{
 assert.equal(core.allowed({navigator:{connection:{saveData:true}}}),false);
 assert.equal(core.allowed({navigator:{connection:{effectiveType:'2g'}}}),false);
 assert.equal(core.allowed({navigator:{connection:{effectiveType:'slow-2g'}}}),false);
 assert.equal(core.allowed({navigator:{connection:{effectiveType:'4g'}}}),true);
});
function harness({styleInitiallyReady=true,saveData=false,alreadyOn=false,failed=false}={}){
 const timers=new Map(),handlers=new Map(),elements=new Map(),sources=new Map(),layers=new Map();
 const events=new Map(),urls=[];
 let count=1,metaCalls=0,protocolCalls=0,styleReady=styleInitiallyReady,adds=0;
 const flags={temperature:alreadyOn,rain:false,clouds:false,wind:false};
 const status={textContent:'Weather layers are preparing in the background once the globe loads.'};
 function element(id){
  if(!elements.has(id)){
   const callbacks=new Map();
   elements.set(id,{addEventListener(type,fn){callbacks.set(type,fn)},
     click(){callbacks.get('click')?.()}});
  }
  return elements.get(id);
 }
 const map={
  isStyleLoaded:()=>styleReady,
  getSource:id=>sources.get(id)||null,
  getLayer:id=>layers.get(id)||null,
  addSource(id,src){
   if(sources.has(id))throw Error('Duplicate source');
   adds++;
   sources.set(id,{...src,setUrl(url){this.url=url;urls.push(url)}});
   urls.push(src.url);
  },
  addLayer(layer,before){layers.set(layer.id,{...layer,before})},
  setLayoutProperty(id,name,value){layers.get(id).layout[name]=value},
  setPaintProperty(id,name,value){layers.get(id).paint[name]=value},
  on(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn)}
 };
 const win={
  document:{getElementById:id=>id==='weather-first-frames-status'?status:element(id)},
  navigator:{connection:{saveData,effectiveType:'4g'}},
  ...cores,
  HereNowTemperature:{ensureProtocol:async()=>{protocolCalls++},isEnabled:()=>flags.temperature},
  HereNowRain:{isEnabled:()=>flags.rain},
  HereNowClouds:{isEnabled:()=>flags.clouds},
  HereNowWind:{isEnabled:()=>flags.wind},
  HereNowWeatherData:{getMetadata:async()=>{
   metaCalls++;
   if(failed)throw Error('offline');
   return metadata;
  }},
  HereNowGlobe:{getMap:()=>map},
  HereNowDiagnostics:{log(){}},
  addEventListener:(type,fn)=>handlers.set(type,fn)
 };
 const context={window:win,document:win.document,Date,Number,Math,Array,String,Map,Set,
  setTimeout:(fn,delay)=>{const id=count++;timers.set(id,{fn,delay});return id},
  clearTimeout:id=>timers.delete(id)
 };
 vm.runInNewContext(script,context,{filename:'first-frame-preload.js'});
 async function flush(){for(let i=0;i<9;i++)await new Promise(resolve=>setImmediate(resolve));}
 async function advance(ms){
  const jobs=[...timers.entries()].filter(([,v])=>v.delay===ms);
  for(const [id,job] of jobs){timers.delete(id);job.fn()}
  await flush();
 }
 function sourcedata(key){for(const fn of events.get('sourcedata')||[])fn({sourceId:key,isSourceLoaded:true})}
 return {win,styleReady:on=>{styleReady=on},flags,timers,metadata,sources,layers,status,urls,advance,sourcedata,
  get metaCalls(){return metaCalls},get protocolCalls(){return protocolCalls},get adds(){return adds}};
}
test('four real sources preload without ANY selected buttons, with visible loading progress',async()=>{
 const h=harness();
 assert.match(h.status.textContent,/Globe detected/);
 await h.advance(350);
 assert.equal(h.metaCalls,1);
 assert.equal(h.protocolCalls,1);
 for(const ms of [0,650,1300,1950])await h.advance(ms);
 assert.equal(h.adds,4);
 assert.equal(h.sources.size,4);
 assert.equal(h.layers.size,4);
 assert.equal(h.win.HereNowFirstFrames.requested(),4);
 assert.equal(h.flags.temperature,false);
 assert(h.urls.every(url=>url.includes('valid_times_')));
 for(const id of ['hn-temperature','hn-rain','hn-clouds','hn-wind'])h.sourcedata(id);
 assert.equal(h.win.HereNowFirstFrames.loaded(),4);
 assert.match(h.status.textContent,/4\/4 real layer sources ready/);
});
test('globe-ready style transition retries instead of leaving default message forever',async()=>{
 const h=harness({styleInitiallyReady:false});
 assert.match(h.status.textContent,/Globe detected/);
 await h.advance(350);
 assert.match(h.status.textContent,/Waiting for its map style/);
 assert.equal(h.metaCalls,0);
 h.styleReady(true);
 await h.advance(700);
 assert.equal(h.metaCalls,1);
 await h.advance(0);
 assert(h.sources.has('hn-temperature'));
});
test('the preloaded source is claimed without re-fetch and its paint can be restored',async()=>{
 const h=harness();await h.advance(350);
 for(const ms of [0,650,1300,1950])await h.advance(ms);
 for(const spec of core.specs(cores,metadata,core.initialFrame(cores,metadata,new Date()))){
  const url=h.sources.get(spec.sourceId).url;
  assert.equal(h.win.HereNowFirstFrames.claim(spec.key,url),true);
  h.layers.get(spec.layerId).paint[spec.opacity]=spec.layer.paint[spec.opacity];
  assert.equal(h.layers.get(spec.layerId).paint[spec.opacity],spec.layer.paint[spec.opacity]);
  assert.equal(h.win.HereNowFirstFrames.claim(spec.key,url),false);
 }
 assert.equal(h.adds,4);
 assert.equal(h.urls.length,4); // no additional setUrl needed when claiming
});
test('tapping a weather button cancels pending extra startup sources',async()=>{
 const h=harness();await h.advance(350);await h.advance(0);
 assert.equal(h.sources.size,1);
 h.flags.clouds=true;
 h.win.document.getElementById('toggle-clouds').click();
 for(const ms of [650,1300,1950])await h.advance(ms);
 assert.equal(h.sources.size,1);
 assert.match(h.status.textContent,/prioritizing your selection/);
});
test('Data Saver and already-enabled weather skip the extra startup tile fetches',async()=>{
 const saving=harness({saveData:true});
 assert.match(saving.status.textContent,/Data Saver/);
 await saving.advance(350);
 assert.equal(saving.metaCalls,0);
 const active=harness({alreadyOn:true});
 await active.advance(350);
 assert.equal(active.metaCalls,0);
 assert.equal(active.sources.size,0);
});
test('failed preload shows useful message but does not activate any layer',async()=>{
 const h=harness({failed:true});
 await h.advance(350);
 assert.match(h.status.textContent,/offline/);
 assert.equal(h.sources.size,0);
 assert.equal(h.flags.temperature,false);
});
