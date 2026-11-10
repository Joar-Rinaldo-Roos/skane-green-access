/* MapLibre globe + SGU layer smoke tests without WebGL or network. */
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const test=require('node:test');
const path=require('node:path');
const vm=require('node:vm');
const code=readFileSync(path.join(__dirname,'..','globe.js'),'utf8');

function boot(supported=true,automatic=false) {
  const handlers={};const elem={};
  for(const id of ['toggle-globe','map','globe-map']){
    elem[id]={hidden:id==='globe-map',disabled:false,textContent:'',attributes:{},
      addEventListener(n,f){handlers[id+':'+n]=f;},
      setAttribute(k,v){this.attributes[k]=v;}};
  }
  const logs=[],callbacks={};
  const controller={
    setLocation(){logs.push('map-location');},clearLocation(){logs.push('clear');},
    setStatus(s){logs.push(s);},resize(){logs.push('resize');},
    scheduleGeologyRefresh(){logs.push('geology-refresh');},
    setViewProvider(f){callbacks.view=f;},
    subscribeGeology(f){callbacks.soil=f; f({type:'data',collection:{type:'FeatureCollection',features:[]},enabled:false});},
    getView(){return {lat:55.7,lon:13.19,zoom:13};}
  };
  class Globe{
    constructor(options){this.options=options;this.handlers={};this.sources={};this.layers={};Globe.last=this;this.center={lng:13.19,lat:55.7};this.zoom=options.zoom;}
    on(name,layerOrFunction,cb){this.handlers[name+(typeof layerOrFunction==='string'?':'+layerOrFunction:'')]=cb||layerOrFunction;}
    setProjection(p){this.projection=p;}
    getCenter(){return this.center;}getZoom(){return this.zoom;}
    getBounds(){return {getWest:()=>13.1,getSouth:()=>55.6,getEast:()=>13.3,getNorth:()=>55.8};}
    addSource(name,o){this.sources[name]={...o,setData(v){this.data=v;}};}
    addLayer(o){this.layers[o.id]=o;}
    getSource(n){return this.sources[n];}
    setLayoutProperty(id,k,v){this.layers[id].layout[k]=v;}
    resize(){logs.push('globe-resize');}
    jumpTo(opts){this.center={lng:opts.center[0],lat:opts.center[1]};this.zoom=opts.zoom;this.jump=opts;}
    remove(){logs.push('remove');}
  }
  class Marker {
    constructor(opts){this.opts=opts;}setLngLat(x){this.coords=x;return this;}
    addTo(map){map.marker=this;return this;}remove(){}
  }
  const maplibregl={supported:()=>supported,Map:Globe,Marker,Popup:class{}};
  const window={HereNowMap:controller,maplibregl:automatic?maplibregl:undefined,
    addEventListener(n,cb){handlers['window:'+n]=cb;}};
  const document={getElementById:id=>elem[id],createElement:tag=>({tagName:tag,className:'',setAttribute(){},appendChild(){}})};
  vm.runInNewContext(code,{window,document,maplibregl});
  return {elem,handlers,controller,Globe,maplibregl,logs,callbacks,window};
}
test('Globe opens automatically when MapLibre module becomes available',()=>{
  const a=boot();
  a.window.maplibregl=a.maplibregl;
  a.handlers['window:here-now-globe-ready']();
  assert.equal(a.elem['map'].hidden,true);
  assert.equal(a.elem['globe-map'].hidden,false);
  assert.equal(a.Globe.last.options.zoom,3.3);
  a.Globe.last.handlers['style.load']();
  assert.equal(a.Globe.last.projection.type,'globe');
  a.Globe.last.handlers.load();
  assert.ok(a.Globe.last.sources['sgu-geology']);
});
test('Find me zooms globe to GPS position at 15 instead of distant zoom 4',()=>{
  const a=boot(true,true);a.Globe.last.handlers.load();
  a.controller.setLocation({lat:55.73,lon:13.2,name:'your location'}, {zoom:15});
  assert.equal(a.Globe.last.jump.zoom,15);
  assert.equal(a.Globe.last.jump.center[1],55.73);
  assert.equal(a.Globe.last.marker.coords[0],13.2);
});
test('SGU GeoJSON draws over globe and stays enabled when toggling to 2D',()=>{
  const a=boot(true,true);a.Globe.last.handlers.load();
  const soil={type:'FeatureCollection',features:[{type:'Feature',properties:{jg2_tx:'Morän',_hereNowColor:'#aabbcc'},geometry:{type:'Polygon',coordinates:[[[13,55],[14,55],[14,56],[13,55]]]}}]};
  a.callbacks.soil({type:'data',collection:soil,enabled:true});
  assert.equal(a.Globe.last.sources['sgu-geology'].data.features.length,1);
  assert.equal(a.Globe.last.layers['sgu-soil-fill'].layout.visibility,'visible');
  a.handlers['toggle-globe:click']();
  assert.equal(a.elem.map.hidden,false);
  assert.ok(a.logs.includes('resize'));
  assert.equal(a.Globe.last.layers['sgu-soil-fill'].layout.visibility,'visible');
});
test('WebGL unavailable leaves 2D map functioning',()=>{
  const a=boot(false);
  a.window.maplibregl=a.maplibregl;
  a.handlers['window:here-now-globe-ready']();
  assert.equal(a.elem.map.hidden,false);
  assert.ok(a.logs.at(-1).includes('WebGL'));
});