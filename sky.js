/* Astronomy Engine computes the positions of the Sun, Moon and planets in the browser.
 * The library is loaded as a standalone script; no location data goes to an astronomy API.
 * Positions describe the sky at 21:00 in the device's local time zone. */
(function(){
  'use strict';
  const names={
    Mercury:'The small, fast planet closest to the Sun, often difficult to spot in twilight.',
    Venus:'Our brilliantly reflective neighbouring planet, which can look like a very bright star.',
    Mars:'The rusty-red planet; its colour comes from iron-rich minerals in its surface.',
    Jupiter:'The Solar System’s largest planet. Binoculars sometimes reveal its four large moons.',
    Saturn:'The giant planet known for its magnificent icy rings.',
    Moon:'Our nearest neighbour; its changing illuminated shape makes the lunar phase.'
  };
  const direction=degrees=>{
    const compass=['N','NE','E','SE','S','SW','W','NW'];
    return compass[Math.round(((degrees%360)+360)%360/45)%8];
  };
  function atTonight() {
    const when=new Date();
    when.setHours(21,0,0,0);
    return when;
  }
  function compute(point,when=atTonight(),engine=window.Astronomy){
    if(!engine||!Number.isFinite(point?.lat)||!Number.isFinite(point?.lon))return null;
    const observer=new engine.Observer(point.lat,point.lon,0);
    const bodies=['Moon','Mercury','Venus','Mars','Jupiter','Saturn'];
    const rows=bodies.map(body=>{
      const equator=engine.Equator(body,when,observer,true,true);
      const horizon=engine.Horizon(when,observer,equator.ra,equator.dec,'normal');
      return {body,altitude:Number(horizon.altitude),azimuth:Number(horizon.azimuth),
        direction:direction(horizon.azimuth),description:names[body],above:horizon.altitude>5};
    }).filter(item=>Number.isFinite(item.altitude)&&Number.isFinite(item.azimuth));
    const moon=rows.find(row=>row.body==='Moon');
    if(moon){
      const illumination=engine.Illumination('Moon',when);
      moon.illuminated=Math.round(illumination.phase_fraction*100);
    }
    return {time:when,rows,visible:rows.filter(row=>row.above)};
  }
  function timeLocal(value) {
    return new Date(value).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
  }
  async function discovery(point){
    const params=new URLSearchParams({lat:point.lat,lng:point.lon,formatted:'0'});
    const response=await fetch('https://api.sunrise-sunset.org/json?'+params);
    window.HereNowDiagnostics?.log('Astronomy','Solar times HTTP '+response.status);
    if(!response.ok)throw Error('Sunrise and sunset service HTTP '+response.status);
    const data=await response.json();
    if(data.status!=='OK')throw Error('Sunrise and sunset unavailable');
    let result=null;
    try{result=compute(point);}catch(error){
      window.HereNowDiagnostics?.log('Astronomy','Planet calculation failed: '+error.message);
    }
    const sunrise=timeLocal(data.results.sunrise),sunset=timeLocal(data.results.sunset);
    if(!result){
      return [{title:'Tonight above '+point.name,category:'Astronomy · tonight',
        text:'Sunrise '+sunrise+' · Sunset '+sunset+'. Planet positions are unavailable because the astronomy calculator has not loaded.',
        url:'https://sunrise-sunset.org/api',meta:'Solar times for your selected location'}];
    }
    const visible=result.visible.map(r=>r.body);
    const moon=result.rows.find(x=>x.body==='Moon');
    const lead=visible.length?'At 21:00, above your horizon: '+visible.join(', ')+'.':'At 21:00, the Moon and major bright planets are low or below the horizon.';
    const moonText=moon?' The Moon is '+moon.illuminated+'% illuminated.':'';
    return [{
      title:'Your sky tonight at 21:00',category:'Astronomy · planets and Moon',
      text:lead+moonText+' Sunrise '+sunrise+' · sunset '+sunset+'.',
      url:'https://github.com/cosinekitty/astronomy',
      meta:'Calculated for '+point.name+' · 21:00 local device time',
      skyRows:result.rows,
      sourceUrl:'https://sunrise-sunset.org/api'
    }];
  }
  window.HereNowSky={compute,discovery,atTonight,direction};
})();