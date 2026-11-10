/* Leaflet SGU GeoJSON source tests without a browser or network. */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname,'..','map.js'),'utf8');

function boot({missingLeaflet=false,features=[{type:'Feature',properties:{jg2_tx:'Morän'},geometry:{type:'Polygon',coordinates:[[[13.19,55.70],[13.2,55.70],[13.2,55.71],[13.19,55.70]]]}}],http=200}={}){
  const events = {};
  const elems={};
  for(const name of ['map-status','toggle-geology','locate']){
    elems[name]={textContent:'',disabled:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,v){events[name+':'+k]=v;},classList:{add(){},remove(){}}};
  }
  const markers=[];
  const mapLayers=new Set();
  const map={
    setView(pos,z){this.center=pos;this.zoom=z;return this;},
    getCenter(){return {lat:this.center[0],lng:this.center[1]};},
    getZoom(){return this.zoom;},
    getBounds(){return {getWest:()=>13.18,getSouth:()=>55.70,getEast:()=>13.21,getNorth:()=>55.72};},
    on(name,cb){events['map:'+name]=cb;},
    invalidateSize(){},
    addLayer(l){mapLayers.add(l);},
    hasLayer(l){return mapLayers.has(l);},
    removeLayer(l){mapLayers.delete(l);}
  };
  const layer=kind=>({
    kind, addTo(m){m.addLayer(this);return this;},bindPopup(p){this.popup=p;return this;},
    clearLayers(){this.collection=[];},
    addData(f){this.collection=f.features;}
  });
  const L={
    map:()=>map,
    tileLayer:()=>layer('osm'),
    geoJSON:()=>layer('geology'),
    circleMarker:()=>{const m=layer('marker');markers.push(m);return m;},
    circle:()=>layer('accuracy'),
    control:{zoom:()=>({addTo(){}}),scale:()=>({addTo(){}})}
  };
  const document={getElementById:id=>elems[id],createElement:name=>({tagName:name,textContent:'',children:[],appendChild(v){this.children.push(v);}})};
  const diagnostics=[];
  const window={L:missingLeaflet?undefined:L,HereNowDiagnostics:{log(...args){diagnostics.push(args);}}};
  const queries=[];
  const fetch=async(url,opts)=>{
    queries.push(url);
    return {ok:http===200,status:http,json:async()=>({type:'FeatureCollection',features})};
  };
  const context={document,window,L,fetch,URLSearchParams,AbortController,setTimeout:()=>1,clearTimeout:()=>{}};
  vm.runInNewContext(code,context);
  return {map,events,elems,window,mapLayers,queries,diagnostics,markers};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('Street map initializes in Lund without invoking SGU prematurely',()=>{
  const a=boot();
  assert.equal(a.map.center[0],55.7047);
  assert.equal(a.map.center[1],13.1910);
  assert.equal(a.queries.length,0);
});
test('Soil geology fetches official OGC API Features with a lon-lat bbox',async()=>{
  const a=boot();
  a.events['toggle-geology:click']();
  await flush();
  assert.equal(a.elems['toggle-geology'].attrs['aria-pressed'],'true');
  assert.equal(a.queries.length,1);
  const url = new URL(a.queries[0]);
  assert.equal(url.hostname,'api.sgu.se');
  assert.match(url.pathname,/collections\/grundlager\/items/);
  assert.equal(url.searchParams.get('bbox'),'13.18000,55.70000,13.21000,55.72000');
  assert.ok([...a.mapLayers].some(l=>l.kind==='geology' && l.collection.length===1));
  assert.match(a.elems['map-status'].textContent,/1 SGU soil polygons/);
});
test('Turning off geology removes polygons and retains street map',async()=>{
  const a=boot();
  a.events['toggle-geology:click']();await flush();
  a.events['toggle-geology:click']();
  assert.equal(a.elems['toggle-geology'].attrs['aria-pressed'],'false');
  assert.ok(![...a.mapLayers].some(l=>l.kind==='geology'));
  assert.ok([...a.mapLayers].some(l=>l.kind==='osm'));
});
test('SGU HTTP errors are shown rather than pretending soil data loaded',async()=>{
  const a=boot({http:503});
  a.events['toggle-geology:click']();
  await flush();
  assert.match(a.elems['map-status'].textContent,/HTTP 503/);
  assert.ok(a.diagnostics.some(d=>d[1].includes('HTTP 503')));
});
test('Selected location marker and privacy-safe popup survive map updates',()=>{
  const a=boot();
  a.window.HereNowMap.setLocation({lat:55.73,lon:13.22,name:'<danger>',accuracy:33},{zoom:15});
  assert.equal(a.map.zoom,15);
  assert.equal(a.markers[0].popup.textContent,'<danger>');
  assert.ok([...a.mapLayers].some(l=>l.kind==='accuracy'));
  a.window.HereNowMap.clearLocation();
  assert.ok(![...a.mapLayers].some(l=>l.kind==='marker'));
});
test('Missing Leaflet degrades geology without breaking the rest',()=>{
  const a=boot({missingLeaflet:true});
  assert.equal(a.elems['toggle-geology'].disabled,true);
  assert.match(a.elems['map-status'].textContent,/Leaflet could not load/);
});
