const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test');
const src=fs.readFileSync(path.join(__dirname,'..','sky.js'),'utf8');
function boot(){
  const window={};
  vm.runInNewContext(src,{window,Date,Math});
  return window.HereNowSky;
}
test('planet and moon positions are calculated for selected GPS coordinates',()=>{
  const sky=boot();
  const mock={
    Observer:class{constructor(lat,lon){this.lat=lat;this.lon=lon;}},
    Equator:(body,date,observer)=>({ra:body,dec:observer.lat}),
    Horizon:(date,observer,ra,dec)=>({altitude:ra==='Jupiter'?40:ra==='Saturn'?15:-15,azimuth:225}),
    Illumination:()=>({phase_fraction:0.63})
  };
  const result=sky.compute({lat:55.71,lon:13.2},new Date('2026-11-10T21:00:00+01:00'),mock);
  assert.equal(result.rows.length,6);
  assert.ok(result.visible.some(x=>x.body==='Jupiter'&&x.altitude===40&&x.direction==='SW'));
  assert.equal(result.rows.find(x=>x.body==='Moon').illuminated,63);
});
test('no astronomy library means solar-only fallback can be displayed',()=>{
  const sky=boot();
  assert.equal(sky.compute({lat:55,lon:13},new Date('2026-11-10T00:00:00Z'),null),null);
});
