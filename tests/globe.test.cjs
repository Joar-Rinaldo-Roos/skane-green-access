/* Globe smoke tests using a fake MapLibre renderer (no WebGL or network). */
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const script = readFileSync(path.join(__dirname, '..', 'globe.js'), 'utf8');

function boot(supported = true) {
  const listeners = {};
  const elements = {};
  for(const id of ['toggle-globe','map','globe-map','toggle-geology']) {
    elements[id] = {
      hidden: id === 'globe-map', disabled: false, textContent:'', attrs: {},
      addEventListener(type, cb) {listeners[id+':'+type] = cb;},
      setAttribute(key,value) {this.attrs[key]=value;}
    };
  }
  const log = [];
  const controller = {
    setLocation(p) {log.push('location');},
    clearLocation() {log.push('clear');},
    showGeology(v) {log.push('geology:'+v);},
    getView(){return {lat:55.7,lon:13.19,zoom:13};},
    resize(){log.push('resize');},
    setStatus(message){log.push(message);}
  };
  class FakeGlobe {
    constructor(options) { this.options=options; this.listeners={}; FakeGlobe.last=this; }
    on(name,cb){this.listeners[name]=cb;}
    setProjection(value){this.projection=value;}
    resize(){log.push('globe-resize');}
    flyTo(options){this.flyOptions=options;}
    remove(){log.push('remove-globe');}
  }
  class Marker {
    constructor(o){this.options=o;}
    setLngLat(x){this.position=x;return this;}
    addTo(map){map.marker=this;return this;}
    remove(){}
  }
  const maplibregl={supported:()=>supported,Map:FakeGlobe,Marker};
  const window={HereNowMap:controller,maplibregl};
  const document={getElementById:id=>elements[id],createElement:tag=>({tagName:tag,attributes:{},setAttribute(k,v){this.attributes[k]=v;}})};
  vm.runInNewContext(script,{window,document,maplibregl});
  return {listeners,elements,controller,FakeGlobe,log};
}
test('globe toggles without enabling SGU geology on the globe',()=>{
  const a=boot();
  a.listeners['toggle-globe:click']();
  assert.equal(a.elements['map'].hidden,true);
  assert.equal(a.elements['toggle-geology'].disabled,true);
  assert.equal(a.FakeGlobe.last.options.style.layers[0].source,'osm');
  a.FakeGlobe.last.listeners['style.load']();
  assert.equal(a.FakeGlobe.last.projection.type,'globe');
  a.FakeGlobe.last.listeners.load();
  a.controller.showGeology(true);
  assert.equal(a.elements['map'].hidden,false);
  assert.equal(a.elements['toggle-geology'].disabled,false);
  assert.equal(a.elements['toggle-globe'].attrs['aria-pressed'],'false');
});
test('globe falls back to street map when WebGL is unavailable',()=>{
  const a=boot(false);
  a.listeners['toggle-globe:click']();
  assert.equal(a.elements['map'].hidden,false);
  assert.match(a.log.at(-1),/WebGL/);
});
test('GPS marker updates on globe and preserves local map behavior',()=>{
  const a=boot();
  a.listeners['toggle-globe:click']();
  a.FakeGlobe.last.listeners['style.load']();
  a.FakeGlobe.last.listeners.load();
  a.controller.setLocation({lat:55.72,lon:13.2,name:'Lund'});
  assert.equal(a.FakeGlobe.last.marker.position[0],13.2);
  assert.equal(a.FakeGlobe.last.flyOptions.zoom,4);
  assert.ok(a.log.includes('location'));
});
