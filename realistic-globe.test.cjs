'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {brightness,darkness,tileHeights,shadePixels,lightPixels,lightPosition,parse,mount}=require('./realistic-globe.js');
test('smooth solar light, twilight and historical light mask',()=>{
 assert(brightness(1)>brightness(.5)&&brightness(.5)>brightness(0)&&brightness(0)>brightness(-.05));
 assert.equal(darkness(.1),0);assert.equal(darkness(-.3),1);
 assert.equal(shadePixels([1,-1])[3],0);assert(shadePixels([1,-1])[7]>240);
 assert.equal(lightPixels([1,-1],new Uint8ClampedArray([255,200,100,255,255,200,100,255]))[3],0);
 assert.equal(lightPixels([1,-1],new Uint8ClampedArray([255,200,100,255,255,200,100,255]))[7],255);
 assert(lightPosition({lat:23,lon:179}).position.every(Number.isFinite));
});
test('solar raster uses XYZ coordinates and changes with solar longitude',()=>{
 const a=tileHeights(0,0,0,{lat:0,lon:0},3),b=tileHeights(0,0,0,{lat:0,lon:180},3);
 assert(a[4]>.99);assert(b[4]<-.99);assert(a[3]<0);
 assert.deepEqual(parse('hn-sun://shade/3/4/2?t=1000'),{kind:'shade',z:3,x:4,y:2,t:1000});
 assert.throws(()=>parse('hn-sun://shade/3/9/2?t=1000'));
});
test('basemap is lazy and changes in place below existing overlays',()=>{
 const nodes=new Map(),sources=new Map(),layers=new Map([['osm',{}],['hn-temperature-raster',{}],['sgu-soil-fill',{}]]),modes=[];
 const doc={getElementById(id){if(!nodes.has(id))nodes.set(id,{setAttribute(){},addEventListener(_,fn){this.click=fn;}});return nodes.get(id);}};
 const win={HereNowDayNight:{setRealistic(v){modes.push(v);},sunAt(){}},maplibregl:{addProtocol(){}}};
 const map={on(){},getStyle(){return {layers:[...layers.keys()].map(id=>({id}))};},getSource:id=>sources.get(id),
 addSource(id,s){sources.set(id,{...s,setTiles(tiles){this.tiles=tiles;}});},getLayer:id=>layers.get(id),
 addLayer(l,before){assert.equal(before,'hn-temperature-raster');layers.set(l.id,l);},
 setLayoutProperty(id,k,v){layers.get(id)[k]=v;},setSky(){},setLight(){}};
 const ui=mount(win,doc);assert.equal(sources.size,0);ui.attach(map);
 assert(ui.isActive());nodes.get('render-realistic').click();assert(ui.isActive());assert.equal(layers.get('osm').visibility,'none');
 assert.equal(sources.size,2);assert.equal(layers.get('hn-blue-marble').visibility,'visible');
 const d=new Date('2026-11-27T12:00:00Z');ui.lighting(true,d,{lat:-20,lon:0});
 assert.equal(sources.size,4);assert.equal(layers.get('hn-solar-shade').visibility,'visible');
 ui.lighting(true,new Date(d.getTime()+60000),{lat:-20,lon:-.25});
 assert(sources.get('hn-solar-shade').tiles[0].endsWith(String(d.getTime()+60000)));
 ui.lighting(false,d,{});assert.equal(layers.get('hn-city-lights').visibility,'none');
 nodes.get('render-street').click();assert(!ui.isActive());assert.equal(layers.get('osm').visibility,'visible');
 assert(layers.has('hn-temperature-raster'));assert(layers.has('sgu-soil-fill'));assert.deepEqual(modes,[true,false]);
});
