'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  temperatureUrl,temperatureSource,temperatureLayer,selectForecastTime,temperatureMetadataUrl
}=require('./temperature-core.js');

test('global temperature uses Open-Meteo DWD ICON and nearest current forecast hour',()=>{
  const url=temperatureUrl();
  assert.match(url,/^om:\/\/https:\/\/openmeteo\.s3\.amazonaws\.com\/data_spatial\/dwd_icon\/latest\.json\?/);
  assert.equal(new URL(url.slice(5)).searchParams.get('variable'),'temperature_2m');
  assert.equal(new URL(url.slice(5)).searchParams.get('time_step'),'current_time_1H');
  assert(!url.includes('api.openweathermap.org'));
});

test('temperature raster remains usable from globe zoomed out to close scale',()=>{
 const source=temperatureSource();
 assert.equal(source.type,'raster');
 assert.equal(source.url,temperatureUrl());
 assert.equal(source.maxzoom,12);
 const layer=temperatureLayer();
 assert.equal(layer.source,'hn-temperature');
 assert.equal(layer.type,'raster');
 assert(layer.paint['raster-opacity']>0&&layer.paint['raster-opacity']<1);
 assert.equal(layer.layout.visibility,'visible');
 assert.equal(temperatureLayer(false).layout.visibility,'none');
});

test('forecast timing uses actual supplied model timestamps instead of device-local guesses',()=>{
 const metadata={valid_times:['2026-11-22T12:00Z','2026-11-22T15:00Z','2026-11-22T18:00Z']};
 assert.equal(selectForecastTime(metadata,new Date('2026-11-22T16:00:00Z')),'2026-11-22T15:00Z');
 assert.equal(selectForecastTime({valid_times:[]}),null);
 assert.equal(selectForecastTime({valid_times:['invalid']}),null);
 assert.match(temperatureMetadataUrl(),/^https:\/\/openmeteo\.s3\.amazonaws\.com\/data_spatial\/dwd_icon\/latest\.json$/);
});

test('raster source does not require GPS, zoom radius or an API secret',()=>{
 const str=JSON.stringify({source:temperatureSource(),layer:temperatureLayer()});
 assert(!str.includes('appid='));
 assert(!str.includes('lat='));
 assert(!str.includes('around:'));
 assert(!str.includes('overpass'));
});
