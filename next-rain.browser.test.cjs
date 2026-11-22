'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const core=require('./next-rain-core.js');
const source=fs.readFileSync('next-rain.js','utf8');

function harness({rainMm=0.5,errorStatus=null}={}){
  const center={lat:55.7047,lon:13.191};
  const fetched=[],nodes=new Map();
  for(const id of ['next-rain-panel','next-rain-refresh','next-rain-headline',
    'next-rain-detail','next-rain-status','next-rain-place']){
    const callbacks={};
    nodes.set(id,{id,textContent:'',disabled:false,
      addEventListener(type,fn){callbacks[type]=fn},
      click(){callbacks.click?.()}
    });
  }
  const now=Date.now();
  const oneHour=3600000;
  const end= Math.ceil(now/oneHour)*oneHour+oneHour; // definitely ahead of now
  const data={hourly:{
    time:[0,1,2].map(i=>new Date(end+i*oneHour).toISOString().slice(0,16)),
    rain:[0,rainMm,0],showers:[0,0,0],
    precipitation_probability:[15,65,10]}};
  const context={
    window:{HereNowNextRainCore:core,HereNowMap:{getView:()=>({...center,zoom:12})},
      HereNowDiagnostics:{log(){}}
    },
    document:{getElementById:id=>nodes.get(id)},
    fetch:async url=>{
      fetched.push(url);
      return errorStatus
        ?{ok:false,status:errorStatus}
        :{ok:true,json:async()=>data};
    },
    AbortController,URL,Date,Number,
    setTimeout:()=>1,clearTimeout:()=>{}
  };
  vm.runInNewContext(source,context,{filename:'next-rain.js'});
  const flush=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve))};
  return {center,nodes,window:context.window,fetched,flush,node:id=>nodes.get(id)};
}

test('initial Next Rain automatically requests the map center, never GPS',async()=>{
 const h=harness();
 await h.flush();
 assert.equal(h.fetched.length,1);
 const url=new URL(h.fetched[0]);
 assert.equal(url.searchParams.get('latitude'),'55.70470');
 assert.equal(url.searchParams.get('longitude'),'13.19100');
 assert.match(h.node('next-rain-headline').textContent,/Next rain/);
 assert.match(h.node('next-rain-detail').textContent,/0\.5 mm/);
 assert.equal(h.node('next-rain-refresh').disabled,false);
});
test('moving the map invalidates earlier prediction and refresh uses new center',async()=>{
 const h=harness();
 await h.flush();
 h.center.lat=56.5;h.center.lon=14.2;
 h.window.HereNowNextRain.onMapMoved();
 assert.match(h.node('next-rain-headline').textContent,/Map moved/);
 assert.match(h.node('next-rain-detail').textContent,/new map center/);
 h.node('next-rain-refresh').click();
 await h.flush();
 assert.equal(h.fetched.length,2);
 assert.equal(new URL(h.fetched[1]).searchParams.get('latitude'),'56.50000');
 assert.match(h.node('next-rain-place').textContent,/56\.50°N/);
 assert.match(h.node('next-rain-headline').textContent,/Next rain/);
});
test('no measurable rain produces a qualified dry forecast instead of certainty',async()=>{
 const h=harness({rainMm:0});
 await h.flush();
 assert.match(h.node('next-rain-headline').textContent,/No measurable rain/);
 assert.match(h.node('next-rain-detail').textContent,/snow and forecast uncertainty/);
});
test('network HTTP errors stay visible and retry button stays enabled',async()=>{
 const h=harness({errorStatus:503});
 await h.flush();
 assert.match(h.node('next-rain-headline').textContent,/unavailable/);
 assert.match(h.node('next-rain-status').textContent,/HTTP 503/);
 assert.equal(h.node('next-rain-refresh').disabled,false);
});
