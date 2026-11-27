/* Optional realistic basemap, inspired by https://makewithmaplibre.com/globe/.
 * Uses the existing globe and solar calculation. No new map or style reset. */
(function(root){
 'use strict';
 const RAD=Math.PI/180, SIZE=256;
 const BLUE='https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg';
 const SENTINEL='https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg';
 const BLACK='https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png';
 const ids=['hn-blue-marble','hn-sentinel','hn-solar-shade','hn-city-lights'];
 const localLayers=new Set(['osm',...ids]);
 const clamp=x=>Math.max(0,Math.min(1,x));
 function smooth(a,b,x){const t=clamp((x-a)/(b-a));return t*t*(3-2*t);}
 function brightness(h){
   return h>=0?0.14+0.86*Math.sqrt(h):0.035+0.105*smooth(Math.sin(-6*RAD),0,h);
 }
 function darkness(h){return smooth(Math.sin(-2*RAD),Math.sin(-9*RAD),h);}
 function tileHeights(z,x,y,sun,size=SIZE){
   const n=2**z, cosLon=new Float64Array(size), result=new Float32Array(size*size);
   const dec=sun.lat*RAD;
   for(let i=0;i<size;i++)cosLon[i]=Math.cos(((x+(i+.5)/size)/n*360-180-sun.lon)*RAD);
   for(let j=0;j<size;j++){
     const lat=Math.atan(Math.sinh(Math.PI*(1-2*(y+(j+.5)/size)/n)));
     const a=Math.sin(lat)*Math.sin(dec),b=Math.cos(lat)*Math.cos(dec);
     for(let i=0;i<size;i++)result[j*size+i]=Math.max(-1,Math.min(1,a+b*cosLon[i]));
   }
   return result;
 }
 function shadePixels(heights){
   const rgba=new Uint8ClampedArray(heights.length*4);
   for(let i=0;i<heights.length;i++){
     rgba[4*i]=2;rgba[4*i+1]=5;rgba[4*i+2]=15;
     rgba[4*i+3]=255*(1-brightness(heights[i]));
   }
   return rgba;
 }
 function lightPixels(heights,source){
   const rgba=new Uint8ClampedArray(source.length);
   for(let i=0;i<heights.length;i++){
     const k=4*i, strength=Math.pow(Math.max(source[k],source[k+1],source[k+2])/255,0.8);
     for(let c=0;c<3;c++)rgba[k+c]=source[k+c]*strength;
     rgba[k+3]=source[k+3]*darkness(heights[i]);
   }
   return rgba;
 }
 function lightPosition(sun){
   const lat=sun.lat*RAD,lon=sun.lon*RAD;
   return {anchor:'map',position:[1.5,Math.atan2(-Math.sin(lat),-Math.cos(lat)*Math.sin(lon))/RAD-90,
     Math.acos(-Math.cos(lat)*Math.cos(lon))/RAD]};
 }
 function tileUrl(kind,date){return 'hn-sun://'+kind+'/{z}/{x}/{y}?t='+date;}
 function parse(url){
   const m=/^hn-sun:\/\/(shade|lights)\/(\d+)\/(\d+)\/(\d+)\?t=(\d+)$/.exec(url);
   if(!m)throw Error('Invalid solar tile');
   const [z,x,y,t]=m.slice(2).map(Number);
   if(z>8||x>=2**z||y>=2**z||!Number.isFinite(t))throw Error('Invalid solar tile coordinates');
   return {kind:m[1],z,x,y,t};
 }
 function makeProtocol(win,sunAt){
   const cache=new Map();
   function canvas(){
     const c=win.document.createElement('canvas');c.width=c.height=SIZE;return c;
   }
   function readLights(z,x,y){
     const key=[z,x,y].join('/');
     let p=cache.get(key);
     if(p)cache.delete(key);
     else{
       p=(async()=>{
         const res=await win.fetch(BLACK.replace('{z}',z).replace('{x}',x).replace('{y}',y));
         if(!res.ok)throw Error('NASA night imagery HTTP '+res.status);
         const bmp=await win.createImageBitmap(await res.blob());
         try{
           const ctx=canvas().getContext('2d',{willReadFrequently:true});
           ctx.drawImage(bmp,0,0,SIZE,SIZE);
           return ctx.getImageData(0,0,SIZE,SIZE).data;
         }finally{bmp.close();}
       })();
       p.catch(()=>{if(cache.get(key)===p)cache.delete(key);});
     }
     cache.set(key,p);
     if(cache.size>32)cache.delete(cache.keys().next().value);
     return p;
   }
   return async function(request,abort){
     const {kind,z,x,y,t}=parse(request.url);
     const h=tileHeights(z,x,y,sunAt(new Date(t)));
     let rgba;
     if(kind==='shade')rgba=shadePixels(h);
     // Don't request city-light imagery for tiles wholly in daylight.
     else if(!h.some(v=>darkness(v)>0))rgba=new Uint8ClampedArray(SIZE*SIZE*4);
     else rgba=lightPixels(h,await readLights(z,x,y));
     if(abort?.signal?.aborted)throw new DOMException('Aborted','AbortError');
     // Return a standard PNG buffer: MapLibre handles premultiplied alpha.
     const c=canvas(),ctx=c.getContext('2d'),img=ctx.createImageData(SIZE,SIZE);
     img.data.set(rgba);ctx.putImageData(img,0,0);
     const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Solar tile encoding failed')),'image/png'));
     return {data:await blob.arrayBuffer()};
   };
 }
 function mount(win,doc){
   const street=doc.getElementById('render-street'),real=doc.getElementById('render-realistic'),status=doc.getElementById('render-status');
   if(!street||!real||!status)return null;
   let map=null,active=false,desired=false,registered=false,lastTime=null,originalLight=null,originalSky=null;
   function visible(id,on){if(map.getLayer(id))map.setLayoutProperty(id,'visibility',on?'visible':'none');}
   function before(){return map.getStyle().layers.find(l=>!localLayers.has(l.id))?.id;}
   function add(id,source,paint={},minzoom){
     if(!map.getSource(id))map.addSource(id,{type:'raster',tileSize:256,...source});
     if(!map.getLayer(id))map.addLayer({id,type:'raster',source:id,paint,layout:{visibility:'none'},...(minzoom===undefined?{}:{minzoom})},before());
   }
   function say(msg){status.textContent=msg;}
   function setAtmosphere(sun){
     if(sun)map.setLight?.(lightPosition(sun));
     else if(originalLight)map.setLight?.(originalLight);
     map.setSky?.(sun?{'atmosphere-blend':['interpolate',['linear'],['zoom'],0,0.9,5,0.9,8,0]}:
       originalSky||{'atmosphere-blend':0});
   }
   function lighting(on,date,sun){
     if(!map||!active)return;
     if(!on){
       visible(ids[2],false);visible(ids[3],false);setAtmosphere(null);return;
     }
     const t=Math.floor(date.getTime()/60000)*60000;
     if(!registered){
       win.maplibregl.addProtocol('hn-sun',makeProtocol(win,win.HereNowDayNight.sunAt));registered=true;
     }
     const shade=tileUrl('shade',t),lights=tileUrl('lights',t);
     add(ids[2],{tiles:[shade],maxzoom:6},{'raster-opacity':['interpolate',['linear'],['zoom'],4,1,8,0],'raster-fade-duration':0});
     add(ids[3],{tiles:[lights],maxzoom:8,attribution:'<a href="https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/">NASA Black Marble (2016)</a>'},
       {'raster-opacity':['interpolate',['linear'],['zoom'],5,1,9,0],'raster-fade-duration':0});
     if(lastTime!==null&&lastTime!==t){
       map.getSource(ids[2]).setTiles([shade]);map.getSource(ids[3]).setTiles([lights]);
     }
     lastTime=t;visible(ids[2],true);visible(ids[3],true);setAtmosphere(sun);
   }
   function apply(){
     if(!map)return;
     try{
       if(desired){
         add(ids[0],{tiles:[BLUE],maxzoom:8,attribution:'<a href="https://nasa-gibs.github.io/gibs-api-docs/">NASA Blue Marble / GIBS</a>'});
         add(ids[1],{tiles:[SENTINEL],minzoom:5,maxzoom:14,attribution:'<a href="https://s2maps.eu/">Sentinel-2 cloudless</a> by EOX IT Services GmbH (modified Copernicus Sentinel data 2016 &amp; 2017) · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>'},
           {'raster-opacity':['interpolate',['linear'],['zoom'],5,0,7,1]},5);
         visible(ids[0],true);visible(ids[1],true);visible('osm',false);
         if(!active){active=true;win.HereNowDayNight?.setRealistic(true);}
         say('Realistic · satellite mosaics, historical city lights and calculated sunlight. Not live imagery.');
       }else{
         visible('osm',true);ids.forEach(id=>visible(id,false));
         if(active){setAtmosphere(null);active=false;win.HereNowDayNight?.setRealistic(false);}
         say('Street map · OpenStreetMap.');
       }
       street.setAttribute('aria-pressed',String(!active));real.setAttribute('aria-pressed',String(active));
     }catch(error){
       desired=false;
       try{visible('osm',true);ids.forEach(id=>visible(id,false));setAtmosphere(null);}catch(_){}
       active=false;win.HereNowDayNight?.setRealistic(false);
       street.setAttribute('aria-pressed','true');real.setAttribute('aria-pressed','false');
       say('Realistic globe could not start. Street map restored. Try again.');
       win.HereNowDiagnostics?.log('Realistic globe',String(error?.message||error));
     }
   }
   function select(on){desired=on;if(map)apply();else say('Waiting for the globe…');}
   street.addEventListener('click',()=>select(false));real.addEventListener('click',()=>select(true));
   return {isActive:()=>active,lighting,attach(nextMap){
     map=nextMap;const style=map.getStyle();
     originalLight=style.light||{anchor:'viewport',position:[1.15,210,30]};
     originalSky=style.sky||null;
     map.on('error',event=>{
       if(active&&ids.includes(event.sourceId))say('Some realistic tiles could not load. Switch to Street map if needed.');
     });
     if(desired)apply();
   }};
 }
 if(typeof module==='object'&&module.exports)module.exports={brightness,darkness,tileHeights,shadePixels,lightPixels,lightPosition,parse,mount};
 if(root?.document)root.HereNowRealistic=mount(root,root.document);
})(typeof window==='object'?window:null);
