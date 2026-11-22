'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('./weather-timeline-core.js');
const now=new Date('2026-11-22T18:10:00Z');
const metadata={
  reference_time:'2026-11-22T12:00:00Z',
  valid_times:Array.from({length:75},(_,i)=>new Date(Date.parse('2026-11-22T16:00:00Z')+i*3600000).toISOString()),
  variables:['precipitation','cloud_cover','temperature_2m','wind_u_component_10m','wind_v_component_10m']
};
test('one timeline selects real model valid_times used by all four layers',()=>{
  const result=core.buildTimeline(metadata,now,48,3);
  assert(result.frames.length>=14&&result.frames.length<=18);
  assert.equal(result.frames[0].index,2);
  assert.equal(result.referenceTime,metadata.reference_time);
  for(const frame of result.frames){
    assert.equal(metadata.valid_times[frame.index],frame.time);
    assert(frame.epoch>=now.getTime()-3600000&&frame.epoch<=now.getTime()+48*3600000);
  }
  for(let i=1;i<result.frames.length;i++)
    assert(result.frames[i].epoch>result.frames[i-1].epoch);
});
test('same global index works in temperature, rain, cloud and wind urls',()=>{
  const result=core.buildTimeline(metadata,now);
  const frame=result.frames[3];
  const urls=[
    require('./temperature-core.js').temperatureUrl(frame),
    require('./rain-forecast-core.js').rainUrl(frame),
    require('./cloud-cover-core.js').cloudUrl(frame),
    require('./wind-core.js').windUrl(frame)
  ];
  for(const url of urls)assert.equal(
    new URL(url.slice(5)).searchParams.get('time_step'),'valid_times_'+frame.index);
});
test('shared animation respects last model hour, rejects bad dates and missing times',()=>{
  const result=core.buildTimeline(metadata,now);
  assert.equal(core.nextFrame(0,result.frames.length),1);
  assert.equal(core.nextFrame(result.frames.length-1,result.frames.length),null);
  assert.equal(core.nextFrame(-1,result.frames.length),null);
  assert.throws(()=>core.buildTimeline({...metadata,valid_times:[]},now),/forecast times/i);
  assert.throws(()=>core.buildTimeline({...metadata,valid_times:['broken']},now),/forecast hours/i);
  assert.throws(()=>core.buildTimeline(metadata,new Date('invalid')),/current date/i);
});
