'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
 buildWindFrames,windUrl,windSource,windLayer,nextWindFrame,metadataUrl
}=require('./wind-core.js');
const now=new Date('2026-11-22T17:10:00Z');
const times=Array.from({length:80},(_,i)=>new Date(Date.parse('2026-11-22T16:00:00Z')+i*3600000).toISOString());
const metadata={variables:['wind_u_component_10m','wind_v_component_10m','temperature_2m'],
 valid_times:times,reference_time:'2026-11-22T12:00:00Z'};
test('wind requires both real global vector components, never assumes direction',()=>{
 assert.throws(()=>buildWindFrames({...metadata,variables:['wind_u_component_10m']},now),/wind vector/i);
 assert.throws(()=>buildWindFrames({...metadata,valid_times:[]},now),/wind forecast hours/i);
 assert.throws(()=>buildWindFrames({...metadata,valid_times:['invalid']},now),/forecast hours/i);
});
test('wind forecast timeline uses real 48-hour indices spaced about three hours',()=>{
 const result=buildWindFrames(metadata,now);
 assert.equal(result.variable,'wind_u_component_10m');
 assert.equal(result.frames[0].index,1);
 assert(result.frames.length>=14&&result.frames.length<=18);
 assert.equal(result.referenceTime,'2026-11-22T12:00:00Z');
 for(let i=0;i<result.frames.length;i++){
  const f=result.frames[i];
  assert.equal(times[f.index],f.time);
  assert(f.epoch<=now.getTime()+48*3600000);
  if(i)assert(f.epoch>result.frames[i-1].epoch);
 }
});
test('OM vector source uses official arrows=true source layer and valid_times model index',()=>{
 const frame=buildWindFrames(metadata,now).frames[1],url=windUrl(frame);
 const uri=new URL(url.slice(5));
 assert.equal(uri.searchParams.get('variable'),'wind_u_component_10m');
 assert.equal(uri.searchParams.get('arrows'),'true');
 assert.equal(uri.searchParams.get('time_step'),'valid_times_'+frame.index);
 assert.equal(windSource(frame).type,'vector');
 assert.equal(windSource(frame).url,url);
 assert.match(metadataUrl(),/dwd_icon\/latest\.json$/);
 assert.equal(windLayer()['source-layer'],'wind-arrows');
 assert.equal(windLayer().type,'line');
 assert.equal(windLayer(false).layout.visibility,'none');
 assert.throws(()=>windUrl({index:-1}),/index/i);
});
test('wind arrows can be layered with temperature, clouds and rain without GPS',()=>{
 const layer=windLayer(true);
 assert.equal(layer.layout.visibility,'visible');
 assert(!JSON.stringify(layer).includes('latitude'));
 assert(!JSON.stringify(layer).includes('longitude'));
 assert(!JSON.stringify(layer).includes('api_key'));
 assert.equal(nextWindFrame(0,14),1);
 assert.equal(nextWindFrame(13,14),null);
 assert.equal(nextWindFrame(-1,14),null);
});
