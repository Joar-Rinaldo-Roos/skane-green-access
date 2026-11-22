'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {vectorSource,vectorLayers,vectorDetail}=require('./green-spaces-core.js');

test('globe green map uses pre-generated vector tiles, not Overpass on every pan',()=>{
  const source=vectorSource();
  assert.equal(source.type,'vector');
  assert.match(source.url,/^https:\/\/tiles\.openfreemap\.org\/planet\/latest$/);
});

test('green tile layers cover named parks plus OSM wood and grass without farmland',()=>{
  const layers=vectorLayers(true);
  assert.deepEqual(layers.map(x=>x['source-layer']),['landcover','landcover','park']);
  assert(layers.every(x=>x.type==='fill'&&x.source==='hn-green-tiles'));
  assert.equal(layers[0].filter[2],'wood');
  assert.equal(layers[1].filter[2],'grass');
  assert(layers.every(x=>x.layout.visibility==='visible'));
  assert(layers.every(x=>x.paint['fill-opacity']<0.7));
  assert(vectorLayers(false).every(x=>x.layout.visibility==='none'));
});

test('vector tile popup identifies limited evidence instead of inventing accessibility',()=>{
 const text=vectorDetail({name:'Park',subclass:'garden'},55.71,13.19);
 assert.equal(text.name,'Park');
 assert.match(text.note,/not verified/i);
 assert.match(text.url,/^https:\/\/www\.openstreetmap\.org\/\#map\/16\/55\.71\/13\.19$/);
});

test('tile overlay does not depend on an Overpass response or location permission',()=>{
 const spec=vectorLayers(true);
 assert(spec.length>=2);
 assert(spec.every(x=>x.source==='hn-green-tiles'));
 assert(!JSON.stringify(spec).includes('interpreter'));
});
