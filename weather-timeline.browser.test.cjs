'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const script=fs.readFileSync('weather-timeline.js','utf8');
const core=require('./weather-timeline-core.js');
function harness(){
 const callbacks=new Map(),nodes=new Map(),timers=new Map(),intervals=new Map();
 let nextId=1;
 const active={temperature:false,rain:false,clouds:false,wind:false};
 const calls={temperature:[],rain:[],clouds:[],wind:[]};
 function node(id){
   if(!nodes.has(id)){
     nodes.set(id,{id,textContent:'',hidden:true,disabled:true,value:'0',max:'0',attributes:{},
       addEventListener(kind,fn){callbacks.set(id+':'+kind,[...(callbacks.get(id+':'+kind)||[]),fn])},
       setAttribute(k,v){this.attributes[k]=v},
       click(){for(const fn of callbacks.get(id+':click')||[])fn()},
       input(){for(const fn of callbacks.get(id+':input')||[])fn()}
     });
   }
   return nodes.get(id);
 }
 const window={
   HereNowWeatherTimelineCore:core,
   HereNowDiagnostics:{log(){}}
 };
 for(const name of ['temperature','rain','clouds','wind']){
   const prop={temperature:'HereNowTemperature',rain:'HereNowRain',clouds:'HereNowClouds',wind:'HereNowWind'}[name];
   window[prop]={isEnabled:()=>active[name],setForecastFrame:frame=>calls[name].push(frame.index)};
   node('toggle-'+(name==='temperature'?'temperature':name==='clouds'?'clouds':name==='rain'?'rain':'wind'))
     .addEventListener('click',()=>{active[name]=!active[name]});
 }
 const now=Date.now(),metadata={reference_time:new Date(now-4*3600000).toISOString(),
   valid_times:Array.from({length:75},(_,i)=>new Date(now-3600000+i*3600000).toISOString())};
 const context={window,document:{getElementById:node},
   fetch:async()=>({ok:true,json:async()=>metadata}),AbortController,Date,Number,URL,Promise,
   setTimeout(fn,ms){const id=nextId++;timers.set(id,{fn,ms});return id},
   clearTimeout(id){timers.delete(id)},
   setInterval(fn,ms){const id=nextId++;intervals.set(id,{fn,ms});return id},
   clearInterval(id){intervals.delete(id)}
 };
 vm.runInNewContext(script,context,{filename:'weather-timeline.js'});
 const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve))};
 return {node,window,active,calls,intervals,timers,flush};
}
test('one shared control starts after first layer, and all active layers get same index',async()=>{
 const h=harness();
 assert.equal(h.node('weather-timeline').hidden,true);
 h.node('toggle-clouds').click();
 await h.flush();
 assert.equal(h.node('weather-timeline').hidden,false);
 assert.equal(h.node('weather-play').disabled,false);
 assert.equal(h.calls.temperature.length,0);
 const frame=h.calls.clouds.at(-1);
 h.node('toggle-wind').click();
 await h.flush();
 assert.equal(h.calls.wind.at(-1),frame);
 h.node('weather-play').click();
 assert.equal(h.intervals.size,1);
 const fn=[...h.intervals.values()][0].fn;
 fn();
 assert.equal(h.calls.clouds.at(-1),h.calls.wind.at(-1));
 assert(h.calls.clouds.at(-1)>frame);
 assert.equal(h.node('weather-play').attributes['aria-pressed'],'true');
});
test('a layer enabled mid-animation joins current time, never restarts clock',async()=>{
 const h=harness();h.node('toggle-rain').click();await h.flush();
 h.node('weather-play').click();
 [...h.intervals.values()][0].fn();
 const current=h.calls.rain.at(-1);
 h.node('toggle-temperature').click();await h.flush();
 assert.equal(h.calls.temperature.at(-1),current);
 assert.equal(h.intervals.size,1);
 assert.equal(h.node('weather-play').attributes['aria-pressed'],'true');
 h.node('toggle-rain').click();await h.flush();
 assert.equal(h.intervals.size,1);
 h.node('toggle-temperature').click();await h.flush();
 assert.equal(h.intervals.size,0);
 assert.equal(h.node('weather-timeline').hidden,true);
});
test('manual shared slider stops playback and updates Rain, Clouds, Temp and Wind in lockstep',async()=>{
 const h=harness();
 for(const id of ['toggle-rain','toggle-clouds','toggle-temperature','toggle-wind'])h.node(id).click();
 await h.flush();
 h.node('weather-play').click();
 assert.equal(h.intervals.size,1);
 h.node('weather-hour').value='3';h.node('weather-hour').input();
 assert.equal(h.intervals.size,0);
 for(const [id,t] of h.timers){if(t.ms===260){h.timers.delete(id);t.fn();}}
 const chosen=h.calls.wind.at(-1);
 assert.equal(chosen,h.calls.rain.at(-1));
 assert.equal(chosen,h.calls.clouds.at(-1));
 assert.equal(chosen,h.calls.temperature.at(-1));
 assert.equal(h.node('weather-play').attributes['aria-pressed'],'false');
});
test('turning off one layer leaves shared animation running for other enabled layers',async()=>{
 const h=harness();h.node('toggle-clouds').click();h.node('toggle-wind').click();await h.flush();
 h.node('weather-play').click();
 h.node('toggle-clouds').click();await h.flush();
 assert.equal(h.intervals.size,1);
 const n=h.calls.clouds.length;
 [...h.intervals.values()][0].fn();
 assert.equal(h.calls.clouds.length,n);
 assert(h.calls.wind.length>1);
});
