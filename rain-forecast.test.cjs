'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  buildRainFrames,rainSource,rainLayer,rainUrl,nextFrameIndex,chooseRainVariable
}=require('./rain-forecast-core.js');
const now=new Date('2026-11-22T12:35:00Z');
const modelTimes=Array.from({length:80},(_,i)=>new Date(Date.parse('2026-11-22T10:00:00Z')+i*3600000).toISOString().replace(':00.000Z','Z'));
const metadata={completed:true,reference_time:'2026-11-22T06:00:00Z',valid_times:modelTimes,variables:['temperature_2m','precipitation','snowfall']};

test('rain forecast selects only actual model-valid timestamps inside a 48-hour window',()=>{
 const result=buildRainFrames(metadata,now,48,3);
 assert.equal(result.variable,'precipitation');
 assert(result.frames.length>=14 && result.frames.length<=18);
 for(const frame of result.frames){
   assert.equal(metadata.valid_times[frame.index],frame.time);
   assert(frame.offsetHours>=-1 && frame.offsetHours<=48);
   assert.match(frame.timeStep,/^valid_times_\d+$/);
 }
 for(let i=1;i<result.frames.length;i++){
   assert(result.frames[i].index>result.frames[i-1].index);
   assert(result.frames[i].epoch>result.frames[i-1].epoch);
 }
 assert.equal(result.frames[0].index,3); // 13:00 UTC, nearest to 12:35 UTC
});

test('rain timeline rejects absent precipitation and does not fabricate model hours',()=>{
 assert.equal(chooseRainVariable(['rain','temperature_2m']),'rain');
 assert.equal(chooseRainVariable(['cloud_cover']),null);
 assert.throws(()=>buildRainFrames({...metadata,variables:['temperature_2m']},now),/precipitation/i);
 assert.throws(()=>buildRainFrames({...metadata,valid_times:[]},now),/forecast times/i);
 const sparse={...metadata,valid_times:['2026-11-22T12:00Z','2026-11-22T18:00Z','2026-11-23T00:00Z']};
 const result=buildRainFrames(sparse,now,48,3);
 assert.deepEqual(result.frames.map(x=>x.index),[0,1,2]);
});

test('MapLibre precipitation source selects model time index, not invented forecast hours',()=>{
 const result=buildRainFrames(metadata,now);
 const f=result.frames[1],url=rainUrl(f,result.variable);
 assert.match(url,/^om:\/\/https:\/\/openmeteo\.s3\.amazonaws\.com\/data_spatial\/dwd_icon\/latest\.json\?/);
 const parsed=new URL(url.slice(5));
 assert.equal(parsed.searchParams.get('variable'),'precipitation');
 assert.equal(parsed.searchParams.get('time_step'),'valid_times_'+f.index);
 const source=rainSource(f,result.variable);
 assert.equal(source.type,'raster');
 assert.equal(source.tileSize,512);
 assert.equal(source.maxzoom,12);
 assert.equal(source.url,url);
 assert.throws(()=>rainUrl({index:-1},'precipitation'),/index/i);
});

test('rain layer can be hidden, remains visible on global map and has bounded opacity',()=>{
 const visible=rainLayer(true),hidden=rainLayer(false);
 assert.equal(visible.type,'raster');
 assert.equal(visible.source,'hn-rain');
 assert.equal(visible.layout.visibility,'visible');
 assert.equal(hidden.layout.visibility,'none');
 assert(visible.paint['raster-opacity']>0 && visible.paint['raster-opacity']<0.85);
});

test('playback stops at last frame instead of requesting non-existent forecast frames',()=>{
 assert.equal(nextFrameIndex(0,17),1);
 assert.equal(nextFrameIndex(15,17),16);
 assert.equal(nextFrameIndex(16,17),null);
 assert.equal(nextFrameIndex(0,0),null);
 assert.equal(nextFrameIndex(-1,17),null);
});
