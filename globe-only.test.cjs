'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const globe=fs.readFileSync('globe.js','utf8');
const controller=fs.readFileSync('globe-map-controller.js','utf8');
const cache=require('./tile-cache.js');
test('globe-only HTML never starts Leaflet or creates a duplicate street map',()=>{
 assert.doesNotMatch(html,/leaflet(@|\.js|\.css)/i);
 assert.doesNotMatch(html,/id="map"/);
 assert.doesNotMatch(html,/id="toggle-globe"/);
 assert.match(html,/id="globe-map"/);
 assert.match(html,/src="\.\/globe-map-controller\.js/);
 assert.match(html,/src="\.\/tile-cache\.js/);
 assert.doesNotMatch(html,/src="\.\/map\.js/);
});
test('MapLibre can retain more tiles, with bounds on mobile and low-memory devices',()=>{
 const desktop={userAgent:'Macintosh',deviceMemory:8};
 const mobile={userAgent:'Mozilla Android',deviceMemory:4};
 const low={userAgent:'Mozilla Android',deviceMemory:2};
 assert.equal(cache.tileLimit(false,desktop),128);
 assert.equal(cache.tileLimit(true,desktop),224);
 assert.equal(cache.tileLimit(false,mobile),72);
 assert.equal(cache.tileLimit(true,mobile),128);
 assert.equal(cache.tileLimit(false,low),48);
 assert.equal(cache.tileLimit(true,low),80);
 const storage=new Map(),store={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 assert.equal(cache.readExtra(store),false);
 assert.equal(cache.saveExtra(store,true),true);
 assert.equal(cache.readExtra(store),true);
});
function harness(){
 const events=new Map(),listeners=new Map(),nodes=new Map();
 let created=0,options=null,map=null;
 function node(id){if(!nodes.has(id)){
  const local=new Map();
  nodes.set(id,{id,hidden:false,textContent:'',classList:{add(){},remove(){}},
   setAttribute(){},addEventListener:(name,fn)=>{local.set(name,fn)},
   click(){local.get('click')?.()}
  });
 }return nodes.get(id);}
 class Map{
  constructor(opts){created++;options=opts;map=this;this.handlers=new Map();this.sources=new globalThis.Map();this.layers=new globalThis.Map();this.center={lat:55.7047,lng:13.1910};this.zoom=3.3;}
  on(event,arg,cb){const fn=cb||arg;this.handlers.set(event,fn)}
  addSource(id,src){this.sources.set(id,{...src,setData(data){this.data=data}})}
  getSource(id){return this.sources.get(id)}
  addLayer(l){this.layers.set(l.id,l)}
  getLayer(id){return this.layers.get(id)}
  setLayoutProperty(){}
  setProjection(projection){this.projection=projection}
  getCenter(){return this.center}
  getZoom(){return this.zoom}
  getBounds(){return {getWest:()=>12,getSouth:()=>55,getEast:()=>14,getNorth:()=>56}}
  jumpTo(info){if(info.zoom)this.zoom=info.zoom;if(info.center)this.center={lat:info.center[1],lng:info.center[0]}}
  resize(){}
 }
 const fakeWindow={
   HereNowTileCache:{maxTiles:()=>224},
   HereNowDiagnostics:{log(){}},
   maplibregl:{Map,supported:()=>true},
   HereNowSoil:{createSummary:()=>({})},
   addEventListener:(event,fn)=>{listeners.set(event,fn)},
   dispatchEvent:()=>{},
   HereNowGreenSpaces:{repaint(){},onMapReady(){},scheduleRefresh(){}}
 };
 const fakeDoc={getElementById:node,createElement:()=>({setAttribute(){}})};
 const context={window:fakeWindow,document:fakeDoc,maplibregl:fakeWindow.maplibregl,
   AbortController,URLSearchParams,fetch:async()=>({ok:true,json:async()=>({type:'FeatureCollection',features:[]})}),
   setTimeout:()=>1,clearTimeout(){},Number,Array,Date,Event:class Event{constructor(type){this.type=type}}};
 vm.runInNewContext(controller,context,{filename:'globe-map-controller.js'});
 vm.runInNewContext(globe,context,{filename:'globe.js'});
 return {window:fakeWindow,nodes,listeners,invoke:(name)=>listeners.get(name)?.(),
   fire:(name)=>map.handlers.get(name)?.(),get map(){return map},get options(){return options},
   get created(){return created}};
}
test('globe initializes once without a 2D toggle and uses configured memory cache',()=>{
 const h=harness();
 assert.equal(h.created,0);
 h.invoke('here-now-globe-ready');
 assert.equal(h.created,1);
 assert.equal(h.options.container,'globe-map');
 assert.equal(h.options.maxTileCacheSize,224);
 h.fire('style.load');h.fire('load');
 assert.equal(h.map.projection.type,'globe');
 assert.equal(h.window.HereNowGlobe.isActive(),true);
 assert(h.window.HereNowGlobe.getMap());
 h.invoke('here-now-globe-ready');
 assert.equal(h.created,1);
});
test('globe-only controller keeps place search, map-center and geology APIs',()=>{
 const h=harness();h.invoke('here-now-globe-ready');h.fire('load');
 assert.equal(h.window.HereNowMap.getView().lat,55.7047);
 assert.equal(h.window.HereNowMap.getLeafletMap(),null);
 h.window.HereNowMap.setLocation({lat:59.33,lon:18.06,name:'Stockholm'},{zoom:12});
 assert.equal(h.map.center.lat,59.33);
 assert.equal(h.window.HereNowMap.getView().lon,18.06);
 assert.equal(h.window.HereNowGlobe.zoomTo(14),true);
 assert.equal(h.map.zoom,14);
 h.window.HereNowMap.showGeology(true);
 assert.equal(h.window.HereNowMap.isGeologyEnabled(),true);
 assert(h.map.getSource('sgu-geology'));
});
