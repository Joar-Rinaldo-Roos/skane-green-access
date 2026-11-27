'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {sunAt,nightGeometry,mount}=require('./day-night.js');
test('solar position at solstices and equinox and six-hour rotation',()=>{
 const june=sunAt(new Date('2026-06-21T12:00:00Z'));
 const dec=sunAt(new Date('2026-12-21T12:00:00Z'));
 const march=sunAt(new Date('2026-03-20T12:00:00Z'));
 assert(june.lat>23&&june.lat<24);
 assert(dec.lat<-23&&dec.lat>-24);
 assert(Math.abs(march.lat)<1);
 assert(Math.abs(june.lon)<2);
 const later=sunAt(new Date('2026-06-21T18:00:00Z'));
 assert(Math.abs(later.lon-june.lon+90)<1);
});
function inside(ring,x,y){
 let hit=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [a,b]=ring[i],[c,d]=ring[j];
  if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;
 }
 return hit;
}
test('night polygons cover the dark hemisphere across poles, dateline and equinox',()=>{
 for(const sun of [{lat:23.4,lon:179},{lat:-23.4,lon:-179},{lat:0,lon:28},{lat:0.001,lon:179},{lat:-0.001,lon:-179}]){
  const data=nightGeometry(sun);
  for(const f of data.features){
   const ring=f.geometry.coordinates[0];
   assert.deepEqual(ring[0],ring.at(-1));
   assert(ring.every(([x,y])=>Math.abs(x)<=180&&Math.abs(y)<=90&&Number.isFinite(y)));
   assert(Math.max(...ring.map(p=>p[0]))-Math.min(...ring.map(p=>p[0]))<=90);
  }
  for(let x=-177;x<180;x+=7)for(let y=-87;y<90;y+=6){
   const rad=Math.PI/180;
   const dot=Math.sin(y*rad)*Math.sin(sun.lat*rad)+Math.cos(y*rad)*Math.cos(sun.lat*rad)*Math.cos((x-sun.lon)*rad);
   if(Math.abs(dot)<0.03)continue;
   assert.equal(data.features.some(f=>inside(f.geometry.coordinates[0],x,y)),dot<0,JSON.stringify({sun,x,y}));
  }
 }
});
test('Earth/Sky switching preserves map, night toggle refreshes and pauses',()=>{
 const nodes=new Map(),timers=new Map();let seq=0,updates=0,resizes=0,stops=0;
 const doc={getElementById(id){if(!nodes.has(id))nodes.set(id,{hidden:false,attrs:{},classList:{toggle(){}},setAttribute(k,v){this.attrs[k]=v;},addEventListener(_,fn){this.click=fn;}});return nodes.get(id);},addEventListener(){}};
 const win={setInterval(fn,ms){assert.equal(ms,60000);timers.set(++seq,fn);return seq;},clearInterval(id){timers.delete(id);},requestAnimationFrame(fn){fn();},HereNowWeatherTimeline:{stop(){stops++;}}};
 const sources=new Map(),layers=new Map();
 const map={on(){},resize(){resizes++;},getSource(id){return sources.get(id);},addSource(id){sources.set(id,{setData(){updates++;}});},getStyle(){return {layers:[{id:'osm'},{id:'sgu-soil-fill'}]};},getLayer(id){return layers.get(id);},addLayer(l,before){assert.equal(before,'sgu-soil-fill');layers.set(l.id,l);},setLayoutProperty(id,k,v){layers.get(id)[k]=v;}};
 const ui=mount(win,doc);ui.attach(map);assert.equal(sources.size,0);
 nodes.get('toggle-day-night').click();assert.equal(sources.size,1);assert.equal(timers.size,1);
 [...timers.values()][0]();assert.equal(updates,1);
 nodes.get('view-sky').click();assert(nodes.get('earth-view').hidden);assert.equal(timers.size,0);assert.equal(stops,1);
 nodes.get('view-earth').click();assert(!nodes.get('earth-view').hidden);assert.equal(resizes,2);assert.equal(sources.size,1);assert.equal(timers.size,1);
 nodes.get('toggle-day-night').click();assert.equal(timers.size,0);assert.equal(layers.get('hn-day-night').visibility,'none');
});
