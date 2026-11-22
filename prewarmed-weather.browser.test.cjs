'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const cases=[
  {key:'rain',path:'rain-forecast.js',core:require('./rain-forecast-core.js'),
    global:'HereNowRainCore',module:'HereNowRain',sourceId:'hn-rain',layerId:'hn-rain-raster',
    builder:'rainSource',build:'buildRainFrames',toggle:'toggle-rain',status:'rain-status',paint:'raster-opacity'},
  {key:'clouds',path:'cloud-cover.js',core:require('./cloud-cover-core.js'),
    global:'HereNowCloudCore',module:'HereNowClouds',sourceId:'hn-clouds',layerId:'hn-clouds-raster',
    builder:'cloudSource',build:'buildCloudFrames',toggle:'toggle-clouds',status:'cloud-status',paint:'raster-opacity'},
  {key:'wind',path:'wind-layer.js',core:require('./wind-core.js'),
    global:'HereNowWindCore',module:'HereNowWind',sourceId:'hn-wind',layerId:'hn-wind-arrows',
    builder:'windSource',build:'buildWindFrames',toggle:'toggle-wind',status:'wind-status',paint:'line-opacity'}
];
function harness(spec){
 const now=Date.now();
 const metadata={variables:['temperature_2m','precipitation','cloud_cover','wind_u_component_10m','wind_v_component_10m'],
  valid_times:Array.from({length:70},(_,i)=>new Date(now-3600000+i*3600000).toISOString()),
  reference_time:new Date(now-21600000).toISOString()};
 const first=spec.core[spec.build](metadata,new Date()).frames[0];
 const sourceSpec=spec.core[spec.builder](first);
 let setUrls=0;
 const source={...sourceSpec,setUrl(url){setUrls++;this.url=url}};
 const layer={id:spec.layerId,layout:{visibility:'visible'},
  paint:{[spec.paint]:0.002}};
 const nodes=new Map(),listeners=new Map(),layers=new Map([[spec.layerId,layer]]);
 const sources=new Map([[spec.sourceId,source]]);
 let attached=0;
 function node(id){
  if(!nodes.has(id)){
   const handlers=new Map(),classes=new Set();
   nodes.set(id,{id,hidden:false,disabled:false,checked:false,value:'0',max:'0',
    textContent:'',attributes:{},
    classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},
    addEventListener(name,fn){handlers.set(name,fn)},setAttribute(k,v){this.attributes[k]=v},
    click(){handlers.get('click')?.()},input(){handlers.get('input')?.()},
    change(){handlers.get('change')?.()}
   });
  }
  return nodes.get(id);
 }
 const map={
  isStyleLoaded:()=>false, // forever busy, but existing weather source is valid
  getSource:id=>sources.get(id)||null,
  getLayer:id=>layers.get(id)||null,
  addSource(){throw Error('Source should already exist')},
  addLayer(){throw Error('Layer should already exist')},
  setPaintProperty(id,key,value){layers.get(id).paint[key]=value},
  setLayoutProperty(id,key,value){layers.get(id).layout[key]=value},
  on(){attached++}
 };
 const win={
  [spec.global]:spec.core,
  HereNowGlobe:{isActive:()=>true,getMap:()=>map},
  HereNowTemperature:{ensureProtocol:async()=>{},isEnabled:()=>false},
  HereNowClouds:{isEnabled:()=>false},
  HereNowRain:{isEnabled:()=>false},
  HereNowWeatherData:{getMetadata:async()=>metadata},
  HereNowFirstFrames:{claim:(key,url)=>key===spec.key&&url===sourceSpec.url},
  HereNowDiagnostics:{log(){}},
  addEventListener(name,fn){listeners.set(name,fn)}
 };
 const context={window:win,document:{getElementById:node},
  fetch:async()=>({ok:true,json:async()=>metadata}),
  setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},
  AbortController,Date,URL,Number,Promise};
 vm.runInNewContext(fs.readFileSync(spec.path,'utf8'),context,{filename:spec.path});
 async function flush(){for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve))}
 return {win,node,map,sources,layers,flush,
   get setUrls(){return setUrls},get attached(){return attached}};
}
for(const spec of cases){
 test(spec.key+' reveals the real preloaded layer despite map.isStyleLoaded() false',async()=>{
  const h=harness(spec);
  h.node(spec.toggle).click();
  await h.flush();
  assert.equal(h.win[spec.module].isEnabled(),true);
  assert.equal(h.node(spec.toggle).attributes['aria-pressed'],'true');
  assert.equal(h.layers.get(spec.layerId).layout.visibility,'visible');
  assert(h.layers.get(spec.layerId).paint[spec.paint]>0.1);
  assert.equal(h.setUrls,0,'Preloaded model URL should be claimed without redundant fetch');
  assert(h.attached>0,'Loaded source events should be observed');
  assert.doesNotMatch(h.node(spec.status).textContent,/Waiting for the 3D globe/);
 });
}
