'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const temp=require('./temperature-core.js');
const cloud=require('./cloud-cover-core.js');
const now=new Date('2026-11-22T12:35:00Z');
const metadata={variables:['temperature_2m','cloud_cover'],
 valid_times:Array.from({length:70},(_,i)=>new Date(Date.parse('2026-11-22T11:00:00Z')+i*3600000).toISOString()),
 reference_time:'2026-11-22T06:00:00Z'};

test('temperature forecast accepts cloud timeline frame from SAME model hour',()=>{
 const frame=cloud.buildCloudFrames(metadata,now).frames[2];
 const url=new URL(temp.temperatureUrl(frame).slice(5));
 const cloudUrl=new URL(cloud.cloudUrl(frame).slice(5));
 assert.equal(url.searchParams.get('variable'),'temperature_2m');
 assert.equal(cloudUrl.searchParams.get('variable'),'cloud_cover');
 assert.equal(url.searchParams.get('time_step'),cloudUrl.searchParams.get('time_step'));
 assert.equal(url.searchParams.get('time_step'),'valid_times_'+frame.index);
 assert.equal(temp.temperatureSource(frame).url,temp.temperatureUrl(frame));
});

test('temperature alone retains nearest-now forecast behaviour and rejects invalid synchronized frames',()=>{
 assert.equal(new URL(temp.temperatureUrl().slice(5)).searchParams.get('time_step'),'current_time_1H');
 assert.equal(temp.temperatureSource().url,temp.temperatureUrl());
 assert.throws(()=>temp.temperatureUrl({index:-1}),/index/i);
 assert.throws(()=>temp.temperatureUrl({index:1.5}),/index/i);
 assert.throws(()=>temp.temperatureUrl({index:10001}),/index/i);
});

test('temperature colours remain below partially transparent clouds',()=>{
 assert.equal(temp.temperatureLayer().type,'raster');
 assert.equal(cloud.cloudLayer().type,'raster');
 assert(temp.temperatureLayer().paint['raster-opacity']>=0.6);
 assert(cloud.cloudLayer().paint['raster-opacity']<=0.5);
});
