/* Real-time geometric day/night boundary. No network requests or extra renderer. */
(function(root){
  'use strict';
  const R=Math.PI/180, D=180/Math.PI;
  const wrap=x=>((x+180)%360+360)%360-180;
  // Low-precision apparent solar coordinates and Greenwich sidereal time.
  // Days since J2000; sufficient for a visual day/night boundary, not navigation.
  function sunAt(date){
    const d=date.getTime()/86400000+2440587.5-2451545;
    if(!Number.isFinite(d))throw new Error('Invalid device time');
    const g=(357.529+0.98560028*d)*R;
    const l=(280.459+0.98564736*d+1.915*Math.sin(g)+0.020*Math.sin(2*g))*R;
    const e=(23.439-0.00000036*d)*R;
    const ra=Math.atan2(Math.cos(e)*Math.sin(l),Math.cos(l))*D;
    return {lat:Math.asin(Math.sin(e)*Math.sin(l))*D,
      lon:wrap(ra-(280.46061837+360.98564736629*d))};
  }
  // In each longitude slice solve sin(lat)*sin(dec)+cos(lat)*cos(dec)*cos(H)=0.
  // Split at the antimeridian and into quarters; no ring wraps around the world.
  // Close toward the dark pole. At exact equinox night is a longitude interval.
  function nightGeometry(sun){
    const features=[];
    function polygon(ring){
      ring.push(ring[0].slice());
      features.push({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[ring]}});
    }
    const decl=sun.lat*R;
    const crossings=[wrap(sun.lon-90),wrap(sun.lon+90)];
    if(Math.abs(decl)<1e-8){
      const edges=[-180,-90,0,90,180,...crossings].sort((a,b)=>a-b);
      for(let i=1;i<edges.length;i++){
        const a=edges[i-1],b=edges[i];
        if(b-a>1e-9&&Math.cos(((a+b)/2-sun.lon)*R)<0)
          polygon([[a,-90],[b,-90],[b,90],[a,90]]);
      }
    }else{
      const pole=decl>0?-90:90;
      const boundary=lon=>Math.atan(-Math.cos((lon-sun.lon)*R)/Math.tan(decl))*D;
      for(let a=-180;a<180;a+=90){
        const b=a+90, xs=[a,b];
        for(let x=a+0.5;x<b;x+=0.5)xs.push(x);
        // Extra detail near the two steep equinox crossings.
        for(const c of crossings)for(const off of [-1,-0.1,-0.01,0,0.01,0.1,1]){
          const x=c+off;if(x>a&&x<b)xs.push(x);
        }
        xs.sort((x,y)=>x-y);
        const ring=xs.map(x=>[x,boundary(x)]);
        ring.push([b,pole],[a,pole]);
        // GeoJSON exterior rings are counterclockwise.
        if(pole<0)ring.reverse();
        polygon(ring);
      }
    }
    return {type:'FeatureCollection',features};
  }
  function mount(win,doc){
    const toggle=doc.getElementById('toggle-day-night');
    const earth=doc.getElementById('view-earth');
    const sky=doc.getElementById('view-sky');
    const earthPanel=doc.getElementById('earth-view');
    const skyPanel=doc.getElementById('sky-view');
    const status=doc.getElementById('day-night-status');
    if(!toggle||!earth||!sky||!earthPanel||!skyPanel||!status)return null;
    const id='hn-day-night';
    let map=null,enabled=false,earthActive=true,timer=null;
    function refresh(){
      if(!enabled||!earthActive)return;
      if(!map){status.textContent='Waiting for the globe…';return;}
      try{
        const data=nightGeometry(sunAt(new Date()));
        const source=map.getSource(id);
        if(source)source.setData(data);
        else map.addSource(id,{type:'geojson',data,maxzoom:8,tolerance:0});
        if(!map.getLayer(id)){
          const before=map.getStyle().layers.find(layer=>layer.id!=='osm')?.id;
          map.addLayer({id,type:'fill',source:id,paint:{
            'fill-color':'#071630','fill-opacity':0.42,'fill-antialias':false
          }},before);
        }
        map.setLayoutProperty(id,'visibility','visible');
        status.textContent='Night is shaded · calculated from your device clock.';
      }catch(error){
        status.textContent='Day & night is waiting for the globe. It will retry automatically.';
        win.HereNowDiagnostics?.log('Day & night',String(error?.message||error));
      }
    }
    function stop(){
      if(timer!==null){win.clearInterval(timer);timer=null;}
    }
    function start(){
      stop();
      if(enabled&&earthActive){refresh();timer=win.setInterval(refresh,60000);}
    }
    toggle.addEventListener('click',()=>{
      enabled=!enabled;
      toggle.setAttribute('aria-pressed',String(enabled));
      toggle.classList.toggle('layer-active',enabled);
      status.hidden=!enabled;
      if(enabled)start();
      else{
        stop();
        if(map?.getLayer(id))map.setLayoutProperty(id,'visibility','none');
      }
    });
    function select(isEarth){
      if(earthActive===isEarth)return;
      earthActive=isEarth;
      earthPanel.hidden=!isEarth;skyPanel.hidden=isEarth;
      earth.setAttribute('aria-pressed',String(isEarth));
      sky.setAttribute('aria-pressed',String(!isEarth));
      if(isEarth){
        // Resize the existing map after its container is visible again.
        win.requestAnimationFrame(()=>{if(earthActive){map?.resize();start();}});
      }else{
        stop();win.HereNowWeatherTimeline?.stop?.();
      }
    }
    earth.addEventListener('click',()=>select(true));
    sky.addEventListener('click',()=>select(false));
    doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)refresh();});
    return {attach(nextMap){
      map=nextMap;
      // The globe emits attach after its load event. An idle event also retries
      // any failed first source creation, without waiting for the next minute.
      map.on('idle',()=>{if(enabled&&earthActive&&!map.getLayer(id))refresh();});
      if(earthActive){map.resize();start();}
    }};
  }
  if(typeof module==='object'&&module.exports)module.exports={sunAt,nightGeometry,mount};
  if(root?.document)root.HereNowDayNight=mount(root,root.document);
})(typeof window==='object'?window:null);
