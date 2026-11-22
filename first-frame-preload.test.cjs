'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('./first-frame-preload.js');
const temperature=require('./temperature-core.js');
const rain=require('./rain-forecast-core.js');
const clouds=require('./cloud-cover-core.js');
const wind=require('./wind-core.js');
const timeline=require('./weather-timeline-core.js');
const script=fs.readFileSync('first-frame-preload.js','utf8');
const metadata={variables:['temperature_2m','precipitation','cloud_cover','wind_u_component_10m','wind_v_component_10m'],
 valid_times:Array.from({length:72},(_,i)=>new Date(Date.parse('2026-11-22T10:00:00Z')+i*3600000).toISOString()),
 reference_time:'2026-11-22T06:00:00Z'};
const now=new Date('2026-11-22T12:20:00Z');
function cores(){
 return {HereNowTemperatureCore:temperature,HereNowRainCore:rain,HereNowCloudCore:clouds,
   HereNowWindCore:wind,HereNowWeatherTimelineCore:timeline};
}
test('all four initial previews use the SAME actual model valid_times index',()=>{
 const win=cores();
 const frame=core.initialFrame(win,metadata,now);
 assert.equal(frame.index,2);
 const specs=core.specs(win,metadata,frame);
 assert.deepEqual(specs.map(item=>item.key),['temperature','rain','clouds','wind']);
 for(const item of specs){
  const url=new URL(item.source.url.slice(5));
  assert.equal(url.searchParams.get('time_step'),'valid_times_2');
  assert.equal(item.source.maxzoom,4);
  assert(item.source.url.startsWith('om://'));
  assert.equal(core.layer(item).source,core.sourceId(item.key));
  assert.equal(core.layer(item).layout.visibility,'visible');
  assert(core.layer(item).paint['raster-opacity']===0.002||
    core.layer(item).paint['line-opacity']===0.002);
 }
});
test('unsupported variables are never silently fabricated',()=>{
 const frame=core.initialFrame(cores(),metadata,now);
 const one=core.specs(cores(),{...metadata,variables:['temperature_2m']},frame);
 assert.deepEqual(one.map(item=>item.key),['temperature']);
 const noV=core.specs(cores(),{...metadata,variables:['wind_u_component_10m']},frame);
 assert.equal(noV.length,0);
 const alt=core.specs(cores(),{...metadata,variables:['rain','wind_u_component_10m','wind_v_component_10m']},frame);
 assert(alt[0].source.url.includes('variable=rain'));
});
test('data saver and slow 2g prevent background tile downloading',()=>{
 assert.equal(core.allowed({navigator:{connection:{saveData:true}}}),false);
 assert.equal(core.allowed({navigator:{connection:{effectiveType:'2g'}}}),false);
 assert.equal(core.allowed({navigator:{connection:{effectiveType:'slow-2g'}}}),false);
 assert.equal(core.allowed({navigator:{connection:{effectiveType:'4g'}}}),true);
});
function harness({dataSaver=false,metadataFailure=false,activeEarly=false}={}){
 const timers=new Map(),handlers=new Map(),elements=new Map(),sources=new Map(),layers=new Map();
 let counter=1,metadataRequests=0,protocolCalls=0;
 const flags={temperature:activeEarly,rain:false,clouds:false,wind:false};
 const status={textContent:''};
 function element(id){
  if(!elements.has(id)){
   const callbacks=new Map();
   elements.set(id,{addEventListener(type,fn){callbacks.set(type,fn)},
     click(){callbacks.get('click')?.()}});
  }
  return elements.get(id);
 }
 let onSourceData=null;
 const map={
  isStyleLoaded:()=>true,
  getSource:id=>sources.get(id),
  getLayer:id=>layers.get(id),
  addSource(id,spec){sources.set(id,spec)},
  addLayer(spec,before){layers.set(spec.id,{...spec,before})},
  on(name,fn){if(name==='sourcedata')onSourceData=fn}
 };
 const win={
  document:{getElementById:id=>id==='weather-first-frames-status'?status:element(id)},
  navigator:{connection:{saveData:dataSaver,effectiveType:'4g'}},
  ...cores(),
  HereNowTemperature:{ensureProtocol:async()=>{protocolCalls++},isEnabled:()=>flags.temperature},
  HereNowRain:{isEnabled:()=>flags.rain},HereNowClouds:{isEnabled:()=>flags.clouds},
  HereNowWind:{isEnabled:()=>flags.wind},
  HereNowWeatherData:{getMetadata:async()=>{
   metadataRequests++;
   if(metadataFailure)throw Error('network unavailable');
   return metadata;
  }},
  HereNowGlobe:{getMap:()=>map},
  HereNowDiagnostics:{log(){}},
  addEventListener:(name,fn)=>handlers.set(name,fn)
 };
 const context={window:win,document:win.document,Date,Number,Math,Array,String,
  setTimeout:(fn,delay)=>{const id=counter++;timers.set(id,{fn,delay});return id},
  clearTimeout:id=>timers.delete(id)
 };
 vm.runInNewContext(script,context,{filename:'first-frame-preload.js'});
 async function flush(){for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve))}
 async function advance(delay){
  const batch=[...timers.entries()].filter(([,x])=>x.delay===delay);
  for(const [id,item] of batch){timers.delete(id);item.fn();}
  await flush();
 }
 return {win,timers,sources,layers,status,flags,handlers,advance,flush,
  load:id=>onSourceData?.({sourceId:id,isSourceLoaded:true}),
  get metadataRequests(){return metadataRequests},get protocolCalls(){return protocolCalls}};
}
test('without any user selections the globe automatically warms four initial weather sources',async()=>{
 const h=harness();
 assert.equal(h.metadataRequests,0);
 assert.equal(h.sources.size,0);
 await h.advance(1200);
 assert.equal(h.metadataRequests,1);
 assert.equal(h.protocolCalls,1);
 assert.equal(h.sources.size,0);
 for(const ms of [0,650,1300,1950])await h.advance(ms);
 assert.equal(h.sources.size,4);
 assert.equal(h.layers.size,4);
 assert.equal(h.win.HereNowFirstFrames.requested(),4);
 assert.deepEqual([...h.sources.values()].map(s=>new URL(s.url.slice(5)).searchParams.get('time_step')).filter(Boolean)
  .length,4);
 for(const key of ['temperature','rain','clouds','wind'])h.load(core.sourceId(key));
 assert.equal(h.win.HereNowFirstFrames.loaded(),4);
 assert.match(h.status.textContent,/4\/4/);
 assert.equal(h.flags.temperature,false); // previews must not turn on user weather layers
});
test('user activating a weather layer cancels pending preload work',async()=>{
 const h=harness();
 await h.advance(1200);
 await h.advance(0);
 assert.equal(h.sources.size,1);
 h.flags.rain=true;
 h.win.document.getElementById('toggle-rain').click();
 for(const ms of [650,1300,1950])await h.advance(ms);
 assert.equal(h.sources.size,1);
});
test('Data Saver or an existing active layer stops automatic startup downloads',async()=>{
 const save=harness({dataSaver:true});await save.advance(1200);
 assert.equal(save.metadataRequests,0);assert.equal(save.sources.size,0);
 const active=harness({activeEarly:true});await active.advance(1200);
 assert.equal(active.metadataRequests,0);assert.equal(active.sources.size,0);
});
test('failed preload does not activate weather or break normal controls',async()=>{
 const h=harness({metadataFailure:true});
 await h.advance(1200);
 assert.equal(h.sources.size,0);
 assert.match(h.status.textContent,/unavailable/);
});
