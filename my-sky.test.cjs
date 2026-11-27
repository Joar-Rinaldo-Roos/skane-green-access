'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {STARS,GUIDES,project,skyObjects,direction}=require('./my-sky.js');
test('all-sky projection: zenith centre, north up, east left, below horizon excluded',()=>{
 assert.deepEqual(project(90,0),{x:180,y:180});
 assert.deepEqual(project(0,0),{x:180,y:33});
 assert(Math.abs(project(0,90).x-33)<1e-10);
 assert(Math.abs(project(0,270).x-327)<1e-10);
 assert.equal(project(-1,0),null);assert.equal(direction(359),'N');
});
test('star catalogue has unique valid coordinates and constellation guide endpoints',()=>{
 const names=new Set(STARS.map(s=>s[0]));assert.equal(names.size,STARS.length);assert(STARS.length>=60);
 for(const [,ra,dec,mag] of STARS){assert(ra>=0&&ra<24&&Math.abs(dec)<=90&&Number.isFinite(mag));}
 for(const [, ...paths] of GUIDES)for(const path of paths)for(const name of path)assert(names.has(name));
});
test('engine receives epoch rotation and local observer/time for each object',()=>{
 const date=new Date('2026-11-27T18:00:00Z');let rotations=0,calls=0;
 const e={Observer:class{constructor(lat,lon){this.lat=lat;this.lon=lon;}},
 MakeTime:d=>d,Rotation_EQJ_EQD:t=>{assert.equal(t,date);return {};},
 Vector:class{constructor(x,y,z,t){this.x=x;this.y=y;this.z=z;this.t=t;}},
 RotateVector:(_,v)=>{rotations++;return v;},EquatorFromVector:()=>({ra:2,dec:5}),
 Equator:(name,t,o)=>{assert.equal(o.lat,55);assert.equal(o.lon,13);calls++;return {ra:1,dec:2};},
 Horizon:(t,o,ra)=>({altitude:ra===1?10:20,azimuth:90})};
 const result=skyObjects(e,{lat:55,lon:13},date);
 assert.equal(rotations,STARS.length);assert.equal(calls,9);assert.equal(result.sunAlt,10);
 assert.equal(result.stars[0].alt,20);assert.equal(result.bodies.find(x=>x.name==='Moon').az,90);
});
