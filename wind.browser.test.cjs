'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const core=require('./wind-core.js');
const script=fs.readFileSync('wind-layer.js','utf8');
function harness({twoD=false}={}){
 const elements=new Map(),events=new Map(),intervals=new Map(),timeouts=new Map(),sources=new Map(),layers=new Map(),requests=[];
 let id=1,globeActive=!twoD;
 function element(key){
  if(!elements.has(key)){
   const handlers=new Map(),classes=new Set();
   elements.set(key,{id:key,value:'0',textContent:'',hidden:false,disabled:false,max:'0',attributes:{},
     classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},
     setAttribute(k,v){this.attributes[k]=v},
     addEventListener(k,fn){handlers.set(k,fn)},
     click(){handlers.get('click')?.()},
     input(){handlers.get('input')?.()}
   });
  }
  return elements.get(key);
 }
 const map={
  isStyleLoaded:()=>true,
  getSource:key=>sources.get(key)||null,
  getLayer:key=>layers.get(key)||null,
  addSource(key,spec){const source={...spec,setUrl(url){this.url=url;requests.push(url)}};sources.set(key,source);requests.push(spec.url)},
  addLayer(spec){layers.set(spec.id,{...spec})},
  setLayoutProperty(id,key,value){layers.get(id).layout[key]=value},
  setPaintProperty(id,key,value){layers.get(id).paint[key]=value},
  on(key,fn){if(!events.has(key))events.set(key,[]);events.get(key).push(fn)}
 };
 const now=Date.now();
 const data={variables:['wind_u_component_10m','wind_v_component_10m'],
   valid_times:Array.from({length:70},(_,i)=>new Date(now-3600000+i*3600000).toISOString()),
   reference_time:new Date(now-6*3600000).toISOString()};
 const window={
  HereNowWindCore:core,HereNowGlobe:{getMap:()=>globeActive?map:null,isActive:()=>globeActive},
  HereNowTemperature:{ensureProtocol:async()=>{}},
  HereNowDiagnostics:{log(){}},
  addEventListener(key,fn){events.set('window:'+key,[fn])}
 };
 element('toggle-globe').click=()=>{globeActive=true;for(const fn of events.get('window:here-now-globe-map-ready')||[])fn()};
 const timerFns={
  setTimeout(fn,ms){const i=id++;timeouts.set(i,{fn,ms});return i},
  clearTimeout(i){timeouts.delete(i)},
  setInterval(fn,ms){const i=id++;intervals.set(i,{fn,ms});return i},
  clearInterval(i){intervals.delete(i)}
 };
 const context={window,document:{getElementById:element},fetch:async()=>({ok:true,json:async()=>data}),
   AbortController,Date,Number,URL,Promise,...timerFns};
 vm.runInNewContext(script,context,{filename:'wind-layer.js'});
 async function flush(){for(let i=0;i<7;i++)await new Promise(resolve=>setImmediate(resolve));}
 function flushSlider(){for(const [id,t] of timeouts){if(t.ms===280){timeouts.delete(id);t.fn()}}}
 return {element,window,map,requests,intervals,sources,layers,flush,flushSlider};
}
test('Wind toggle adds official OM vector arrow source without hiding other weather layers',async()=>{
 const h=harness();
 h.element('toggle-wind').click();await h.flush();
 assert.equal(h.element('toggle-wind').attributes['aria-pressed'],'true');
 assert.equal(h.element('wind-forecast-controls').hidden,false);
 assert.equal(h.element('wind-play').disabled,false);
 assert(h.requests[0].includes('variable=wind_u_component_10m'));
 assert(h.requests[0].includes('arrows=true'));
 assert.equal(h.sources.get('hn-wind').type,'vector');
 assert.equal(h.layers.get('hn-wind-arrows')['source-layer'],'wind-arrows');
});
test('Wind slider changes actual vector model time, not a decorative animation',async()=>{
 const h=harness();
 h.element('toggle-wind').click();await h.flush();
 const first=h.requests.at(-1);
 h.element('wind-hour').value='1';h.element('wind-hour').input();h.flushSlider();
 const second=h.requests.at(-1);
 assert.notEqual(second,first);
 assert.equal(new URL(second.slice(5)).searchParams.get('time_step'),
              'valid_times_'+(Number(new URL(first.slice(5)).searchParams.get('time_step').split('_').at(-1))+3));
 assert.match(h.element('wind-time-label').textContent,/Forecast valid/);
});
test('Wind Play/Pause moves forward and hide stops requests and hides the arrows',async()=>{
 const h=harness();
 h.element('toggle-wind').click();await h.flush();
 h.element('wind-play').click();
 assert.equal(h.intervals.size,1);
 const before=h.requests.length;
 [...h.intervals.values()][0].fn();
 assert(h.requests.length>before);
 h.element('toggle-wind').click();
 assert.equal(h.intervals.size,0);
 assert.equal(h.layers.get('hn-wind-arrows').layout.visibility,'none');
 assert.equal(h.element('wind-forecast-controls').hidden,true);
});
test('Wind can activate the 3D globe from 2D map without GPS',async()=>{
 const h=harness({twoD:true});
 h.element('toggle-wind').click();await h.flush();
 assert(h.sources.has('hn-wind'));
 assert.equal(h.element('toggle-wind').attributes['aria-pressed'],'true');
});
