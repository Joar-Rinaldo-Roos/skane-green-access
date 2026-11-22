'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const helpers=require('./weather-prefetch.js');
const cloud=require('./cloud-cover-core.js');
const rain=require('./rain-forecast-core.js');
const temperature=require('./temperature-core.js');
const wind=require('./wind-core.js');
const script=fs.readFileSync('weather-prefetch.js','utf8');
const frames=[{index:3,time:'2026-11-22T12:00:00Z'},
 {index:6,time:'2026-11-22T15:00:00Z'},
 {index:9,time:'2026-11-22T18:00:00Z'}];

test('next frame is the actual next model timestamp; no prefetch past horizon',()=>{
 assert.equal(helpers.nextFrame(frames,0).index,6);
 assert.equal(helpers.nextFrame(frames,1).index,9);
 assert.equal(helpers.nextFrame(frames,2),null);
 assert.equal(helpers.nextFrame(frames,-1),null);
 assert.equal(helpers.nextFrame([],0),null);
});

test('preload source uses low zoom, never the full worldwide forecast',()=>{
 const item={key:'clouds',source:cloud.cloudSource};
 const source=helpers.buildSource(item,frames[1]);
 assert.equal(source.maxzoom,5);
 assert.equal(source.type,'raster');
 assert.equal(new URL(source.url.slice(5)).searchParams.get('time_step'),'valid_times_6');
 assert.equal(helpers.buildLayer(source).paint['raster-opacity'],0.002);
 const vector=helpers.buildSource({key:'wind',source:wind.windSource},frames[1]);
 assert.equal(vector.maxzoom,5);
 assert.equal(helpers.buildLayer(vector)['source-layer'],'wind-arrows');
 assert.equal(helpers.buildLayer(vector).type,'line');
});

test('prefetch skips automatic downloads on Save Data or 2g',()=>{
 assert.equal(helpers.allowed({navigator:{connection:{saveData:true}}}),false);
 assert.equal(helpers.allowed({navigator:{connection:{effectiveType:'slow-2g'}}}),false);
 assert.equal(helpers.allowed({navigator:{connection:{effectiveType:'2g'}}}),false);
 assert.equal(helpers.allowed({navigator:{connection:{effectiveType:'4g'}}}),true);
});

function harness({saveData=false,slow=false}={}){
 const timers=new Map(),sources=new Map(),layers=new Map(),events=new Map();
 let next=1,removed=0,requests=[];
 const status={textContent:''};
 const map={
   isStyleLoaded:()=>true,
   getSource:id=>sources.get(id)||null,
   getLayer:id=>layers.get(id)||null,
   addSource(id,s){sources.set(id,{...s,setUrl(url){this.url=url;requests.push(url)}});requests.push(s.url)},
   addLayer(layer){layers.set(layer.id,layer)},
   removeLayer(id){layers.delete(id)},
   removeSource(id){sources.delete(id);removed++},
   setLayoutProperty(id,name,value){const l=layers.get(id);if(l)l.layout[name]=value},
   on(event,fn){events.set(event,fn)}
 };
 const flags={clouds:false,rain:false,temperature:false,wind:false};
 const win={
   document:{getElementById:id=>id==='weather-prefetch-status'?status:null},
   navigator:{connection:{saveData,effectiveType:slow?'2g':'4g'}},
   HereNowDiagnostics:{log(){}},
   HereNowGlobe:{getMap:()=>map},
   HereNowCloudCore:cloud,HereNowRainCore:rain,
   HereNowTemperatureCore:temperature,HereNowWindCore:wind,
   HereNowClouds:{isEnabled:()=>flags.clouds},
   HereNowRain:{isEnabled:()=>flags.rain},
   HereNowTemperature:{isEnabled:()=>flags.temperature},
   HereNowWind:{isEnabled:()=>flags.wind},
   addEventListener:(id,fn)=>{events.set(id,fn)}
 };
 const context={window:win,document:win.document,
   setTimeout:fn=>{const id=next++;timers.set(id,fn);return id},
   clearTimeout:id=>timers.delete(id),
   Number,Math,Array,String
 };
 vm.runInNewContext(script,context,{filename:'weather-prefetch.js'});
 function flush(){for(const [id,fn] of [...timers]){timers.delete(id);fn()}}
 return {win,map,flags,status,timers,requests,sources,layers,flush,
   get removed(){return removed}};
}
test('one next-frame layer loads only once and refreshes URLs when frame changes',()=>{
 const h=harness();h.flags.clouds=true;
 h.win.HereNowWeatherPrefetch.schedule(frames,0);
 assert.equal(h.sources.size,0);
 h.flush();
 assert.equal(h.sources.size,1);
 assert.equal(h.layers.size,1);
 assert.equal(h.requests.length,1);
 assert(h.requests[0].includes('valid_times_6'));
 h.win.HereNowWeatherPrefetch.schedule(frames,1);
 h.flush();
 assert.equal(h.sources.size,1);
 assert.equal(h.requests.length,2);
 assert(h.requests[1].includes('valid_times_9'));
 h.win.HereNowWeatherPrefetch.schedule(frames,2);
 h.flush();
 assert.equal(h.layers.get(helpers.LAYER_ID).layout.visibility,'none');
});
test('prefetch selects an enabled overlay and reuses at most one source when switching type',()=>{
 const h=harness();h.flags.temperature=true;
 h.win.HereNowWeatherPrefetch.schedule(frames,0);h.flush();
 assert(h.requests.at(-1).includes('temperature_2m'));
 h.flags.temperature=false;h.flags.wind=true;
 h.win.HereNowWeatherPrefetch.schedule(frames,0);h.flush();
 assert(h.requests.at(-1).includes('wind_u_component_10m'));
 assert.equal(h.sources.size,1);
 assert.equal(h.layers.size,1);
 assert.equal(h.removed,1);
 assert.equal(h.layers.get(helpers.LAYER_ID).type,'line');
});
test('Data Saver prevents extra forecast tiles without blocking normal weather use',()=>{
 const h=harness({saveData:true});h.flags.rain=true;
 h.win.HereNowWeatherPrefetch.schedule(frames,0);h.flush();
 assert.equal(h.sources.size,0);
 assert.match(h.status.textContent,/save data/i);
});
test('disabling the last weather layer hides prefetch without new requests',()=>{
 const h=harness();h.flags.clouds=true;
 h.win.HereNowWeatherPrefetch.schedule(frames,0);h.flush();
 h.win.HereNowWeatherPrefetch.clear();
 assert.equal(h.layers.get(helpers.LAYER_ID).layout.visibility,'none');
 assert.equal(h.requests.length,1);
});
