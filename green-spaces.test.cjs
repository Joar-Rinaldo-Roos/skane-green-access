'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildOverpassQuery,toGeoJSON,cacheKey,kindFromTags,desiredZoom,fetchOverpass}=require('./green-spaces-core.js');
const rectangle=(left,bottom,right,top)=>[
 {lon:left,lat:bottom},{lon:right,lat:bottom},{lon:right,lat:top},
 {lon:left,lat:top},{lon:left,lat:bottom}];
test('Overpass query requests bounded, tagged green polygons only',()=>{
 const q=buildOverpassQuery({lat:55.705,lon:13.191},900);
 assert.match(q,/\[out:json\]/);
 assert.match(q,/around:900,55\.70500,13\.19100/);
 assert.match(q,/leisure/);
 assert.match(q,/landuse/);
 assert.match(q,/out geom/);
 assert.throws(()=>buildOverpassQuery({lat:999,lon:13},900),/coordinates/);
 assert.throws(()=>buildOverpassQuery({lat:55,lon:13},200000),/radius/);
});
test('Converts a closed OSM park way to correctly ordered GeoJSON coordinates',()=>{
 const data={elements:[{type:'way',id:12,tags:{leisure:'park',name:'Test Park'},geometry:rectangle(13.19,55.70,13.20,55.71)}]};
 const result=toGeoJSON(data);
 assert.equal(result.type,'FeatureCollection');
 assert.equal(result.features.length,1);
 const [f]=result.features;
 assert.equal(f.geometry.type,'Polygon');
 assert.deepEqual(f.geometry.coordinates[0][0],[13.19,55.70]);
 assert.equal(f.properties.kind,'Park');
 assert.equal(f.properties.name,'Test Park');
 assert.equal(f.properties.url,'https://www.openstreetmap.org/way/12');
});
test('Rejects unclosed ways, non-green tags, and invalid source coordinates',()=>{
 const data={elements:[
  {type:'way',id:1,tags:{leisure:'park'},geometry:rectangle(13,55,14,56).slice(0,4)},
  {type:'way',id:2,tags:{building:'yes'},geometry:rectangle(13,55,14,56)},
  {type:'way',id:3,tags:{landuse:'forest'},geometry:rectangle(200,55,201,56)}
 ]};
 assert.equal(toGeoJSON(data).features.length,0);
});
test('Converts multipolygon relation with interior hole without double rendering member ways',()=>{
 const outer=rectangle(13.19,55.70,13.22,55.73),inner=rectangle(13.20,55.71,13.21,55.72);
 const result=toGeoJSON({elements:[
   {type:'way',id:42,tags:{leisure:'park'},geometry:outer},
   {type:'relation',id:7,tags:{type:'multipolygon',leisure:'park',name:'With a pond'},
     members:[{type:'way',ref:42,role:'outer',geometry:outer},{type:'way',ref:43,role:'inner',geometry:inner}]}
 ]});
 assert.equal(result.features.length,1);
 assert.equal(result.features[0].geometry.type,'MultiPolygon');
 assert.equal(result.features[0].geometry.coordinates[0].length,2);
 assert.equal(result.features[0].properties.url,'https://www.openstreetmap.org/relation/7');
});
test('Recognizes forest and provides a stable rounded cache key',()=>{
 assert.equal(kindFromTags({natural:'wood'}),'Forest');
 assert.equal(kindFromTags({landuse:'grass'}),'Green area');
 assert.equal(kindFromTags({building:'house'}),null);
 assert.equal(cacheKey({lat:55.70496,lon:13.19104}),cacheKey({lat:55.70497,lon:13.19105}));
});

// Regressions reported by Android user: slow remote queries and missing auto-zoom.
test('map toggle auto-zooms out-of-range views but does not zoom an already detailed view',()=>{
 assert.equal(desiredZoom(3.3),13);
 assert.equal(desiredZoom(11.9),13);
 assert.equal(desiredZoom(13),13);
 assert.equal(desiredZoom(16),16);
});
test('first query is lightweight and excludes huge relation geometries',()=>{
 const q=buildOverpassQuery({lat:55.705,lon:13.191},700);
 assert.match(q,/\[timeout:12\]/);
 assert.doesNotMatch(q,/relation\[/);
 assert.match(q,/way\[/);
});
test('request retries a different Overpass server after timeout',async()=>{
 const attempted=[];
 const result=await fetchOverpass({lat:55.705,lon:13.191},{
  radius:700,timeoutMs:100,
  endpoints:['https://first.test/api/interpreter','https://second.test/api/interpreter'],
  fetchFn:async url=>{
   attempted.push(url);
   if(attempted.length===1)throw Object.assign(new Error('request timed out'),{name:'AbortError'});
   return {ok:true,json:async()=>({elements:[{type:'way',id:7,tags:{leisure:'park'},geometry:rectangle(13.19,55.70,13.20,55.71)}]})};
  }
 });
 assert.equal(attempted.length,2);
 assert.match(attempted[1],/^https:\/\/second\.test/);
 assert.equal(result.data.elements.length,1);
});
test('runtime errors from Overpass are treated as failures, not empty results',async()=>{
 await assert.rejects(()=>fetchOverpass({lat:55.705,lon:13.191},{
  endpoints:['https://only.test/api/interpreter'],timeoutMs:100,
  fetchFn:async()=>({ok:true,json:async()=>({remark:'runtime error: Query timed out',elements:[]})})
 }),/unavailable|timed out|runtime error/i);
});
