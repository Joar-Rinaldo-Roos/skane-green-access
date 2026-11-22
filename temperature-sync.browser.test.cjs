'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('./temperature-core.js');
// The live ESM dependency is replaced with a deterministic fake weather protocol
// *only inside the test*, while CI separately checks the actual CDN library.
const original=fs.readFileSync('temperature-layer.js','utf8');
assert(original.includes('await import(PACKAGE)'));
const script=original.replace('await import(PACKAGE)','await Promise.resolve({omProtocol(){}})');

function harness({cloudFrame=null}={}){
  const nodes=new Map(),listeners=new Map(),sources=new Map(),layers=['osm','hn-clouds-raster'];
  const events=new Map(),urls=[],timeouts=new Map();
  let next=1,active=true,rainHidden=0,cloudHidden=0;
  function node(id){
    if(!nodes.has(id)){
      const callbacks=new Map(),classes=new Set();
      nodes.set(id,{id,textContent:'',hidden:false,disabled:false,attributes:{},
        setAttribute(k,v){this.attributes[k]=v},
        classList:{toggle(k,on){if(on)classes.add(k);else classes.delete(k)}},
        addEventListener(event,fn){callbacks.set(event,fn)},
        click(){callbacks.get('click')?.()}
      });
    }
    return nodes.get(id);
  }
  const map={
    isStyleLoaded:()=>true,
    getSource:id=>sources.get(id)||null,
    getLayer:id=>layers.includes(id)?{id}:null,
    addSource(id,spec){sources.set(id,{...spec,setUrl(url){this.url=url;urls.push(url)}});urls.push(spec.url)},
    addLayer(spec,before){const i=layers.indexOf(before);layers.splice(i<0?layers.length:i,0,spec.id)},
    setLayoutProperty(){},
    on(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn)}
  };
  const win={
    HereNowTemperatureCore:core,
    HereNowGlobe:{isActive:()=>active,getMap:()=>map},
    HereNowClouds:{isEnabled:()=>!!cloudFrame,currentFrame:()=>cloudFrame,hide(){cloudHidden++}},
    HereNowRain:{hide(){rainHidden++}},
    maplibregl:{addProtocol(){}},
    HereNowDiagnostics:{log(){}},
    addEventListener(name,fn){listeners.set(name,fn)}
  };
  const forecastMetadata={valid_times:['2026-11-22T12:00Z','2026-11-22T15:00Z']};
  const context={window:win,document:{getElementById:node},
    setTimeout:fn=>{const id=next++;timeouts.set(id,fn);return id},
    clearTimeout:id=>{timeouts.delete(id)},
    fetch:async()=>({ok:true,json:async()=>forecastMetadata}),
    AbortController,Date,Promise,Number,URL
  };
  vm.runInNewContext(script,context,{filename:'temperature-layer.js'});
  const flush=async()=>{for(let i=0;i<7;i++)await new Promise(resolve=>setImmediate(resolve))};
  return {win,map,node,layers,urls,flush,
    get rainHidden(){return rainHidden},get cloudHidden(){return cloudHidden}};
}

test('Temperature enabled over active Clouds starts on the identical model timestamp and BELOW the clouds',async()=>{
 const first={index:12,time:'2026-11-23T00:00:00Z'};
 const h=harness({cloudFrame:first});
 h.node('toggle-temperature').click();
 await h.flush();
 assert.equal(h.win.HereNowTemperature.isEnabled(),true);
 assert.equal(h.node('toggle-temperature').attributes['aria-pressed'],'true');
 assert.equal(h.cloudHidden,0);
 assert(h.urls[0].includes('variable=temperature_2m'));
 assert(h.urls[0].includes('time_step=valid_times_12'));
 assert(h.layers.indexOf('hn-temperature-raster')<h.layers.indexOf('hn-clouds-raster'));
 assert.match(h.node('temperature-forecast-time').textContent,/Nov/);
 assert.match(h.node('temperature-forecast-time').textContent,/23/);;
});

test('Cloud timeline moves an enabled temperature source and the timestamp to exactly the same hour',async()=>{
 const h=harness();
 h.node('toggle-temperature').click();
 await h.flush();
 assert(h.urls[0].includes('time_step=current_time_1H'));
 const frame={index:15,time:'2026-11-23T03:00:00Z'};
 assert.equal(h.win.HereNowTemperature.setForecastFrame(frame),true);
 assert(h.urls.at(-1).includes('time_step=valid_times_15'));
 assert.match(h.node('temperature-forecast-time').textContent,/Nov/);
 assert.match(h.node('temperature-forecast-time').textContent,/23/);;
 assert.equal(h.win.HereNowTemperature.setForecastFrame(null),true);
 assert(h.urls.at(-1).includes('time_step=current_time_1H'));
});

test('Temperature toggle does not hide Clouds or Rain when using unified timeline',async()=>{
 const h=harness({cloudFrame:{index:2,time:'2026-11-22T15:00:00Z'}});
 h.node('toggle-temperature').click();
 await h.flush();
 assert.equal(h.cloudHidden,0);
 assert.equal(h.rainHidden,0);
 h.node('toggle-temperature').click();
 assert.equal(h.win.HereNowTemperature.isEnabled(),false);
 assert.equal(h.cloudHidden,0);
 assert.equal(h.win.HereNowTemperature.setForecastFrame({index:-1,time:'2026-11-22T12:00Z'}),false);
});
