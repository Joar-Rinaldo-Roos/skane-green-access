'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  buildCloudFrames,cloudSource,cloudLayer,cloudUrl,nextCloudFrameIndex,metadataUrl
}=require('./cloud-cover-core.js');
const now=new Date('2026-11-22T12:35:00Z');
const times=Array.from({length:80},(_,i)=>new Date(Date.parse('2026-11-22T10:00:00Z')+i*3600000).toISOString().replace(':00.000Z','Z'));
const metadata={reference_time:'2026-11-22T06:00:00Z',valid_times:times,variables:['temperature_2m','cloud_cover','precipitation']};
test('uses only actual published ICON global times for the next 48 hours',()=>{
 const model=buildCloudFrames(metadata,now,48,3);
 assert.equal(model.variable,'cloud_cover');
 assert.equal(model.frames[0].index,3);
 assert(model.frames.length>=14&&model.frames.length<=18);
 assert.equal(model.referenceTime,'2026-11-22T06:00:00Z');
 for(let i=0;i<model.frames.length;i++){
  const frame=model.frames[i];
  assert.equal(frame.time,times[frame.index]);
  assert(frame.epoch>=now.getTime()-3600000&&frame.epoch<=now.getTime()+48*3600000);
  if(i)assert(frame.epoch>model.frames[i-1].epoch);
 }
});
test('cloud cover must exist in model metadata, with valid future times',()=>{
 assert.throws(()=>buildCloudFrames({...metadata,variables:['precipitation']},now),/cloud cover/i);
 assert.throws(()=>buildCloudFrames({...metadata,valid_times:[]},now),/forecast times/i);
 assert.throws(()=>buildCloudFrames({...metadata,valid_times:['invalid']},now),/forecast times/i);
 const sparse={...metadata,valid_times:['2026-11-22T12:00Z','2026-11-22T18:00Z','2026-11-23T00:00Z']};
 assert.deepEqual(buildCloudFrames(sparse,now,48,3).frames.map(f=>f.index),[0,1,2]);
});
test('cloud raster uses Open-Meteo om protocol, cloud_cover and real valid_time index',()=>{
 const frame=buildCloudFrames(metadata,now).frames[1];
 const url=cloudUrl(frame);
 assert.match(url,/^om:\/\/https:\/\/openmeteo\.s3\.amazonaws\.com\/data_spatial\/dwd_icon\/latest\.json\?/);
 const query=new URL(url.slice(5)).searchParams;
 assert.equal(query.get('variable'),'cloud_cover');
 assert.equal(query.get('time_step'),'valid_times_'+frame.index);
 assert.match(metadataUrl(),/dwd_icon\/latest\.json$/);
 const source=cloudSource(frame);
 assert.equal(source.type,'raster');
 assert.equal(source.maxzoom,12);
 assert.equal(source.tileSize,512);
 assert.equal(source.url,url);
 assert.throws(()=>cloudUrl({index:-1}),/index/i);
});
test('cloud layer visibility and opacity are explicitly bounded and globe-safe',()=>{
 const layer=cloudLayer(true),hidden=cloudLayer(false);
 assert.equal(layer.source,'hn-clouds');
 assert.equal(layer.type,'raster');
 assert.equal(layer.layout.visibility,'visible');
 assert.equal(hidden.layout.visibility,'none');
 assert(layer.paint['raster-opacity']>=0.3&&layer.paint['raster-opacity']<=0.75);
 assert(!JSON.stringify(layer).includes('latitude'));
 assert(!JSON.stringify(layer).includes('api_key'));
});
test('cloud playback never requests a forecast frame beyond the final valid index',()=>{
 assert.equal(nextCloudFrameIndex(0,17),1);
 assert.equal(nextCloudFrameIndex(16,17),null);
 assert.equal(nextCloudFrameIndex(-1,17),null);
 assert.equal(nextCloudFrameIndex(0,0),null);
});
