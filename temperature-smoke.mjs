/* Network smoke test for the exact URLs used by the browser.
 * This probes availability; it is NOT a browser, WebGL or mobile-rendering test. */
const targets=[
 ['Open-Meteo model metadata','https://openmeteo.s3.amazonaws.com/data_spatial/dwd_icon/latest.json',true],
 ['Open-Meteo MapLibre library','https://unpkg.com/@openmeteo/weather-map-layer@0.3.2/dist/index.mjs',false],
 ['Open-Meteo render worker','https://unpkg.com/@openmeteo/weather-map-layer@0.3.2/dist/worker.js',false],
 ['Open-Meteo file decoder WASM','https://unpkg.com/@openmeteo/weather-map-layer@0.3.2/dist/om_file_format.web.wasm',false]
];
for(const [name,url,readBody] of targets){
 const control=new AbortController();
 const timer=setTimeout(()=>control.abort(),20000);
 try{
   const response=await fetch(url,{method:readBody?'GET':'HEAD',signal:control.signal});
   if(!response.ok)throw Error(name+' returned HTTP '+response.status);
   if(readBody){
     const data=await response.json();
     if(!Array.isArray(data?.valid_times)||!data.valid_times.length)throw Error('No model valid_times');
     if(!Array.isArray(data?.variables)||!data.variables.includes('temperature_2m'))
       throw Error('Global model does not expose temperature_2m');
     console.log(name+': '+data.valid_times.length+' valid forecast times, temperature_2m available');
   }else console.log(name+': HTTP '+response.status+' ('+(response.headers.get('content-type')||'unspecified')+')');
 }finally{clearTimeout(timer)}
}
