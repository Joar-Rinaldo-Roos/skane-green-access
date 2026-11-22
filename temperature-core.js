/* Here & Now temperature overlay configuration.
 * Open-Meteo DWD ICON global: numerical MODEL FORECAST, not live thermometer readings.
 * Shared with Node tests; never embeds a user position or secret. */
(function(root){
  'use strict';
  const MODEL_META='https://openmeteo.s3.amazonaws.com/data_spatial/dwd_icon/latest.json';
  function temperatureMetadataUrl(){return MODEL_META;}
  function temperatureUrl(){
    return 'om://'+MODEL_META+'?time_step=current_time_1H&variable=temperature_2m';
  }
  function temperatureSource(){
    return {type:'raster',url:temperatureUrl(),maxzoom:12,tileSize:512,
      attribution:'Weather model © Open-Meteo · DWD ICON Global'};
  }
  function temperatureLayer(enabled=true){
    return {id:'hn-temperature-raster',type:'raster',source:'hn-temperature',
      paint:{'raster-opacity':0.67,'raster-fade-duration':0},
      layout:{visibility:enabled?'visible':'none'}};
  }
  function selectForecastTime(metadata,now=new Date()){
    const values=Array.isArray(metadata?.valid_times)?metadata.valid_times:[];
    const target=now instanceof Date?now.getTime():new Date(now).getTime();
    if(!Number.isFinite(target))return null;
    let nearest=null,best=Infinity;
    for(const raw of values){
      const value=typeof raw==='string'?Date.parse(raw):NaN;
      if(!Number.isFinite(value))continue;
      const diff=Math.abs(target-value);
      if(diff<best){best=diff;nearest=raw;}
    }
    return nearest;
  }
  const api={temperatureMetadataUrl,temperatureUrl,temperatureSource,temperatureLayer,selectForecastTime};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.HereNowTemperatureCore=api;
})(typeof window==='undefined'?null:window);
