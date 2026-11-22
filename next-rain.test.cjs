'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {forecastUrl,findNextRain,formatRainWindow,coordinateLabel}=require('./next-rain-core.js');
const now=new Date('2026-11-22T12:15:00Z');
const times=['2026-11-22T12:00','2026-11-22T13:00','2026-11-22T14:00','2026-11-22T15:00','2026-11-22T16:00'];
function response(rain,showers=[0,0,0,0,0],probabilities=[10,20,35,70,80]){
 return {hourly:{time:times,rain,showers,precipitation_probability:probabilities},
   hourly_units:{rain:'mm',showers:'mm',precipitation_probability:'%'}};
}
test('Open-Meteo request uses active map coordinates, 48 hourly hours, rain and showers, and UTC',()=>{
 const url=new URL(forecastUrl({lat:55.7047,lon:13.191}));
 assert.equal(url.origin,'https://api.open-meteo.com');
 assert.equal(url.pathname,'/v1/forecast');
 assert.equal(url.searchParams.get('latitude'),'55.70470');
 assert.equal(url.searchParams.get('longitude'),'13.19100');
 assert.equal(url.searchParams.get('hourly'),'rain,showers,precipitation_probability');
 assert.equal(url.searchParams.get('forecast_hours'),'48');
 assert.equal(url.searchParams.get('timezone'),'UTC');
 assert.equal(url.searchParams.get('precipitation_unit'),'mm');
 assert.equal(url.searchParams.get('models'),'best_match');
 assert.equal(url.searchParams.get('apikey'),null);
 assert.throws(()=>forecastUrl({lat:91,lon:13}),/coordinates/i);
 assert.throws(()=>forecastUrl({lat:55,lon:-185}),/coordinates/i);
});
test('reports first actual rain + showers interval, excluding expired hours',()=>{
 const result=findNextRain(response([10,0,0.1,0,0],[0,0,0.2,0,0]),now);
 assert.equal(result.kind,'rain');
 assert.equal(result.start.toISOString(),'2026-11-22T13:00:00.000Z');
 assert.equal(result.end.toISOString(),'2026-11-22T14:00:00.000Z');
 assert.equal(result.amountMm,0.3);
 assert.equal(result.probability,35);
});
test('detects predicted rain in the ongoing hour without mislabeling it as future',()=>{
 const result=findNextRain(response([0,0.4,0,0,0]),now);
 assert.equal(result.kind,'rain');
 assert.equal(result.ongoing,true);
 assert.equal(result.end.toISOString(),'2026-11-22T13:00:00.000Z');
});
test('high precipitation probability with zero liquid rain is not claimed as rain',()=>{
 const result=findNextRain(response([0,0,0,0,0],[0,0,0,0,0],[80,80,90,90,90]),now);
 assert.equal(result.kind,'dry');
 assert.equal(result.maxProbability,90);
});
test('null-only rainfall returns unavailable, not a dry forecast',()=>{
 const result=findNextRain(response([null,null,null,null,null],[null,null,null,null,null]),now);
 assert.equal(result.kind,'unavailable');
});
test('no rainfall above minimum threshold reports no measurable rain, not no precipitation',()=>{
 const result=findNextRain(response([0,0.05,0.1,0,0]),now);
 assert.equal(result.kind,'dry');
 assert.equal(result.thresholdMm,0.2);
});
test('ISO hourly timestamps are interpreted as UTC and reject invalid data',()=>{
 assert.equal(findNextRain({hourly:{time:['invalid'],rain:[1],showers:[0]}},now).kind,'unavailable');
 assert.equal(findNextRain({hourly:{time:[],rain:[],showers:[]}},now).kind,'unavailable');
 assert.equal(findNextRain(null,now).kind,'unavailable');
});
test('rain forecast time window and coordinate label are explicit and human-readable',()=>{
 const result=findNextRain(response([0,0.4,0,0,0]),now);
 const label=formatRainWindow(result.start,result.end,'Europe/Stockholm');
 assert.match(label,/13:00/);
 assert.match(label,/14:00/);
 assert.equal(coordinateLabel({lat:55.7047,lon:13.191}),'55.70°N, 13.19°E');
});
