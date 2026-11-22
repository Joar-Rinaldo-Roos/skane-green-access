'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const cloudCore=require('./cloud-cover-core.js');
const script=fs.readFileSync('cloud-cover.js','utf8');

function harness({startIn2D=false,temperatureInitiallyOn=true}={}){
  const listeners=new Map(),events=new Map(),timers=new Map(),intervals=new Map();
  let nextId=1,globeActive=!startIn2D,temperatureOn=temperatureInitiallyOn;
  const elements=new Map();
  function element(id){
    if(!elements.has(id)){
      const local=new Map(),classes=new Set();
      elements.set(id,{
        id,value:'0',max:'0',textContent:'',disabled:false,hidden:false,checked:false,
        attributes:{},
        classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},
        addEventListener(name,fn){if(!local.has(name))local.set(name,[]);local.get(name).push(fn)},
        setAttribute(name,val){this.attributes[name]=val},
        click(){for(const fn of local.get('click')||[])fn()},
        input(){for(const fn of local.get('input')||[])fn()},
        change(){for(const fn of local.get('change')||[])fn()}
      });
    }
    return elements.get(id);
  }
  const requests=[],sources=new Map(),layers=new Map(),mapHandlers=new Map();
  const synchronized=[],opacityChanges=[];
  const map={
    isStyleLoaded:()=>true,
    getSource:id=>sources.get(id)||null,
    getLayer:id=>layers.get(id)||null,
    addSource(id,spec){
      const source={...spec,setUrl(url){this.url=url;requests.push(url)}};
      sources.set(id,source);requests.push(spec.url);
    },
    addLayer(spec){layers.set(spec.id,{...spec})},
    setLayoutProperty(id,name,value){const layer=layers.get(id);if(layer)layer.layout[name]=value},
    setPaintProperty(id,name,value){opacityChanges.push({id,name,value});const layer=layers.get(id);if(layer)layer.paint[name]=value},
    on(name,fn){if(!mapHandlers.has(name))mapHandlers.set(name,[]);mapHandlers.get(name).push(fn)}
  };
  const now=Date.now();
  const modelTimes=Array.from({length:70},(_,i)=>new Date(now-3600000+i*3600000).toISOString());
  const metadata={variables:['cloud_cover','temperature_2m'],
    valid_times:modelTimes,reference_time:new Date(now-6*3600000).toISOString()};
  function dispatch(name){for(const fn of events.get(name)||[])fn()}
  element('toggle-temperature').click=()=>{temperatureOn=!temperatureOn};
  element('toggle-globe').click=()=>{globeActive=true;dispatch('here-now-globe-map-ready')};
  const win={
    HereNowCloudCore:cloudCore,
    HereNowDiagnostics:{log(){}},
    HereNowTemperature:{isEnabled:()=>temperatureOn,ensureProtocol:async()=>{},
      setForecastFrame:frame=>{synchronized.push(frame?{index:frame.index,time:frame.time}:null)}},
    HereNowRain:{hide(){}}, 
    HereNowGlobe:{isActive:()=>globeActive,getMap:()=>globeActive?map:null},
    addEventListener(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn)}
  };
  const fakeTimers={
    setTimeout(fn,ms){const id=nextId++;timers.set(id,{fn,ms});return id},
    clearTimeout(id){timers.delete(id)},
    setInterval(fn,ms){const id=nextId++;intervals.set(id,{fn,ms});return id},
    clearInterval(id){intervals.delete(id)}
  };
  const context={
    window:win,document:{getElementById:element},
    fetch:async()=>({ok:true,json:async()=>metadata}),
    AbortController,Date,URL,Number,Promise,
    ...fakeTimers
  };
  vm.runInNewContext(script,context,{filename:'cloud-cover.js'});
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  async function flush(){
    for(let i=0;i<5;i++)await tick();
  }
  function runSliderTimer(){
    for(const [id,v] of timers){
      if(v.ms===280){timers.delete(id);v.fn();}
    }
  }
  return {element,win,map,requests,intervals,sources,layers,synchronized,opacityChanges,flush,runSliderTimer,
    get temperatureOn(){return temperatureOn}};
}

test('cloud button keeps temperature on and synchronizes both weather layers on slider',async()=>{
  const h=harness();
  h.element('toggle-clouds').click();
  await h.flush();
  assert.equal(h.temperatureOn,true);
  assert.equal(h.element('cloud-with-temperature').checked,true);
  assert(h.synchronized.length>0);
  const initialFrame=h.synchronized.at(-1);
  assert(initialFrame && Number.isInteger(initialFrame.index));
  assert.equal(h.element('toggle-clouds').attributes['aria-pressed'],'true');
  assert.equal(h.element('cloud-forecast-controls').hidden,false);
  assert.equal(h.element('cloud-play').disabled,false);
  assert(h.requests[0].includes('variable=cloud_cover'));
  assert(h.requests[0].includes('time_step=valid_times_'));
  const first=h.requests[0];
  h.element('cloud-hour').value='1';
  h.element('cloud-hour').input();
  h.runSliderTimer();
  assert(h.requests.length>1);
  assert.notEqual(h.requests.at(-1),first);
  assert.equal(h.synchronized.at(-1).index,initialFrame.index+3);
  assert.equal(h.element('cloud-time-label').textContent.includes('Forecast valid:'),true);
  h.element('toggle-clouds').click();
  assert.equal(h.layers.get('hn-clouds-raster').layout.visibility,'none');
  assert.equal(h.element('cloud-forecast-controls').hidden,true);
  assert.equal(h.temperatureOn,true);
  assert.equal(h.synchronized.at(-1),null);
});

test('Play/Pause advances one real frame and stops when turned off',async()=>{
  const h=harness();
  h.element('toggle-clouds').click();
  await h.flush();
  h.element('cloud-play').click();
  assert.equal(h.element('cloud-play').attributes['aria-pressed'],'true');
  assert.equal(h.intervals.size,1);
  const before=h.requests.length;
  const fn=[...h.intervals.values()][0].fn;
  fn();
  assert(h.requests.length>before);
  assert(h.synchronized.at(-1).index>h.synchronized.at(-2).index);
  h.win.HereNowClouds.hide();
  assert.equal(h.intervals.size,0);
  assert.equal(h.element('cloud-play').attributes['aria-pressed'],'false');
});

test('cloud toggle switches from 2D to the globe and waits for globe readiness',async()=>{
  const h=harness({startIn2D:true});
  h.element('toggle-clouds').click();
  await h.flush();
  assert(h.sources.has('hn-clouds'));
  assert.equal(h.element('toggle-clouds').attributes['aria-pressed'],'true');
});

test('Clouds start alone when Temperature was off, then user can opt into the combination',async()=>{
 const h=harness({temperatureInitiallyOn:false});
 h.element('toggle-clouds').click();
 await h.flush();
 assert.equal(h.temperatureOn,false);
 assert.equal(h.element('cloud-with-temperature').checked,false);
 assert.equal(h.synchronized.length,0);
 assert(h.layers.has('hn-clouds-raster'));
 h.element('cloud-with-temperature').checked=true;
 h.element('cloud-with-temperature').change();
 assert.equal(h.temperatureOn,true);
 assert(h.synchronized.length>0);
 const frame=h.synchronized.at(-1);
 assert(Number.isInteger(frame.index));
 h.element('cloud-with-temperature').checked=false;
 h.element('cloud-with-temperature').change();
 assert.equal(h.temperatureOn,false);
});

test('cloud opacity slider adjusts cloud blend without changing the temperature model hour',async()=>{
 const h=harness();
 h.element('toggle-clouds').click();
 await h.flush();
 const before=h.synchronized.at(-1).index;
 h.element('cloud-opacity').value='35';
 h.element('cloud-opacity').input();
 assert.equal(h.element('cloud-opacity-value').textContent,'35%');
 assert(h.opacityChanges.some(x=>x.id==='hn-clouds-raster'&&x.name==='raster-opacity'&&x.value===0.35));
 assert.equal(h.synchronized.at(-1).index,before);
});
