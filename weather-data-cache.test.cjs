'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('weather-data-cache.js','utf8');
const URL='https://openmeteo.s3.amazonaws.com/data_spatial/dwd_icon/latest.json';
const metadata={reference_time:'2026-11-22T12:00:00Z',valid_times:['2026-11-22T15:00:00Z'],variables:['temperature_2m','cloud_cover']};
function harness({session=null,saveData=false,slow=false,fail=false}={}){
 const stored=session||new Map();
 let calls=0,prepared=0;
 const listeners={};
 const timers=[];
 const window={
   HereNowDiagnostics:{log(){}},
   navigator:{connection:{saveData,effectiveType:slow?'2g':'4g'}},
   sessionStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)},
   maplibregl:{addProtocol(){}},
   HereNowTemperature:{ensureProtocol:async()=>{prepared++}},
   addEventListener:(name,callback)=>{listeners[name]=callback},
   requestIdleCallback:callback=>{timers.push(callback)}
 };
 const context={
   window,AbortController,Date,JSON,Promise,
   setTimeout:callback=>{timers.push(callback);return 1},clearTimeout:()=>{},
   fetch:async url=>{calls++;assert.equal(url,URL);if(fail)throw Error('offline');return {ok:true,json:async()=>metadata}}
 };
 vm.runInNewContext(source,context,{filename:'weather-data-cache.js'});
 return {window,stored,listeners,timers,
   get calls(){return calls},get prepared(){return prepared},
   flush:async()=>{for(const task of timers.splice(0))task();for(let i=0;i<7;i++)await new Promise(resolve=>setImmediate(resolve))}
 };
}
test('overlapping forecast layers share one in-flight metadata request',async()=>{
 const h=harness();
 const [a,b,c]=await Promise.all(Array.from({length:3},()=>h.window.HereNowWeatherData.getMetadata()));
 assert.equal(h.calls,1);
 assert.deepEqual(a,b);assert.deepEqual(b,c);
 await h.window.HereNowWeatherData.getMetadata();
 assert.equal(h.calls,1);
 assert.equal(h.window.HereNowWeatherData.isCached(),true);
});
test('idle time prefetches model metadata and preloads renderer without extra clicks',async()=>{
 const h=harness();
 assert.equal(h.calls,0);
 await h.flush();
 assert.equal(h.calls,1);
 assert.equal(h.prepared,1);
 await h.window.HereNowWeatherData.warm();
 assert.equal(h.calls,1);
 assert.equal(h.prepared,1);
});
test('session cache reuses recent metadata after page reload',async()=>{
 const storage=new Map();
 const first=harness({session:storage});
 await first.window.HereNowWeatherData.getMetadata();
 assert.equal(first.calls,1);
 const second=harness({session:storage});
 const data=await second.window.HereNowWeatherData.getMetadata();
 assert.equal(second.calls,0);
 assert.equal(data.reference_time,metadata.reference_time);
});
test('expired session data is never used for model indices',async()=>{
 const storage=new Map();
 storage.set('here-now:dwd-icon-metadata:v1',JSON.stringify({data:metadata,saved:Date.now()-3600000}));
 const h=harness({session:storage});
 await h.window.HereNowWeatherData.getMetadata();
 assert.equal(h.calls,1);
});
test('Save Data and 2g do not start expensive automatic weather prefetch',async()=>{
 for(const opts of [{saveData:true},{slow:true}]){
   const h=harness(opts);
   await h.flush();
   assert.equal(h.calls,0);
   assert.equal(h.prepared,0);
   await h.window.HereNowWeatherData.getMetadata();
   assert.equal(h.calls,1); // explicit activation still works
 }
});
test('failed network request is retried and never permanently memoized',async()=>{
 const h=harness({fail:true});
 await assert.rejects(h.window.HereNowWeatherData.getMetadata(),/offline/);
 await assert.rejects(h.window.HereNowWeatherData.getMetadata(),/offline/);
 assert.equal(h.calls,2);
});
