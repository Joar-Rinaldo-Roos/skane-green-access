/* Local sky chart: selected bright stars, not a complete catalogue.
 * Approximate J2000 positions (hours, degrees, visual magnitude), rounded for visual use.
 * Reference: https://astro101.wwu.edu/a101_brightstars.html and standard J2000 coordinates.
 * Astronomy Engine handles rotation of epoch, horizon and solar-system ephemerides. */
(function(root){
 'use strict';
 const RAD=Math.PI/180;
 const STARS=[
 ['Sirius',6.7525,-16.716,-1.46],['Canopus',6.3992,-52.696,-.74],['Arcturus',14.261,19.182,-.05],
 ['Vega',18.6156,38.784,.03],['Capella',5.2782,45.998,.08],['Rigel',5.2423,-8.202,.13],
 ['Procyon',7.655,5.225,.34],['Betelgeuse',5.9195,7.407,.5],['Achernar',1.6286,-57.237,.46],
 ['Hadar',14.0637,-60.373,.61],['Altair',19.8464,8.868,.76],['Aldebaran',4.5987,16.509,.85],
 ['Antares',16.4901,-26.432,.96],['Spica',13.4199,-11.161,.97],['Pollux',7.7553,28.026,1.14],
 ['Fomalhaut',22.9608,-29.622,1.16],['Deneb',20.6905,45.280,1.25],['Regulus',10.1395,11.967,1.35],
 ['Adhara',6.9771,-28.972,1.5],['Castor',7.5767,31.888,1.58],['Gacrux',12.5194,-57.113,1.63],
 ['Shaula',17.5601,-37.104,1.62],['Bellatrix',5.4189,6.35,1.64],['Elnath',5.4382,28.608,1.65],
 ['Miaplacidus',9.22,-69.717,1.67],['Alnilam',5.6036,-1.202,1.69],['Alnair',22.1372,-46.961,1.74],
 ['Alnitak',5.6793,-1.943,1.77],['Alioth',12.9005,55.96,1.77],['Mirfak',3.4054,49.861,1.79],
 ['Dubhe',11.0621,61.751,1.79],['Wezen',7.1399,-26.393,1.83],['Kaus Australis',18.4029,-34.385,1.79],
 ['Alkaid',13.7923,49.313,1.86],['Sargas',17.6219,-42.998,1.86],['Menkalinan',5.9921,44.947,1.9],
 ['Atria',16.8111,-69.028,1.92],['Peacock',20.4275,-56.735,1.94],['Alhena',6.6285,16.399,1.93],
 ['Polaris',2.5303,89.264,1.98],['Mirach',1.1622,35.621,2.05],['Alpheratz',.1398,29.09,2.06],
 ['Hamal',2.1196,23.462,2.0],['Rasalhague',17.5822,12.56,2.08],['Saiph',5.7959,-9.67,2.07],
 ['Kochab',14.8451,74.155,2.08],['Algol',3.1361,40.956,2.12],['Denebola',11.8177,14.572,2.14],
 ['Mintaka',5.5334,-.299,2.23],['Merak',11.0307,56.382,2.37],['Phecda',11.8972,53.694,2.44],
 ['Megrez',12.2571,57.033,3.31],['Mizar',13.3987,54.925,2.23],['Caph',.1529,59.15,2.27],
 ['Schedar',.6751,56.537,2.24],['Gamma Cas',.9451,60.717,2.47],['Ruchbah',1.4303,60.235,2.68],
 ['Segin',1.9066,63.67,3.35],['Pherkad',15.3455,71.834,3.05],['Acrux',12.4433,-63.099,.76],
 ['Alpha Centauri',14.6601,-60.834,-.27],['Mimosa',12.7953,-59.689,1.25],['Delta Crucis',12.2524,-58.749,2.79],
 ['Sadr',20.3705,40.257,2.23],['Albireo',19.512,27.96,3.05],['Gienah Cyg',20.7702,33.97,2.46],['Delta Cyg',19.7496,45.13,2.87]
 ];
 const GUIDES=[
 ['Orion',['Betelgeuse','Bellatrix','Mintaka','Alnilam','Alnitak','Saiph','Rigel','Mintaka'],['Betelgeuse','Alnitak']],
 ['Big Dipper',['Dubhe','Merak','Phecda','Megrez','Dubhe'],['Megrez','Alioth','Mizar','Alkaid']],
 ['Cassiopeia',['Caph','Schedar','Gamma Cas','Ruchbah','Segin']],
 ['Southern Cross',['Gacrux','Acrux'],['Delta Crucis','Mimosa']],
 ['Cygnus',['Deneb','Sadr','Albireo'],['Delta Cyg','Sadr','Gienah Cyg']]
 ];
 const BODIES=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune'];
 const mod=x=>((x%360)+360)%360;
 const valid=p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lon)&&Math.abs(p.lat)<=90;
 const direction=a=>['N','NE','E','SE','S','SW','W','NW'][Math.round(mod(a)/45)%8];
 function project(alt,az,r=147){
   if(!Number.isFinite(alt)||!Number.isFinite(az)||alt<0||alt>90.001)return null;
   const d=(90-Math.min(90,alt))/90*r;
   return {x:180-d*Math.sin(az*RAD),y:180-d*Math.cos(az*RAD)};
 }
 function skyObjects(engine,point,date){
   if(!engine||!valid(point))throw Error('Astronomy engine or location unavailable');
   const obs=new engine.Observer(point.lat,point.lon,0),time=engine.MakeTime(date),rotation=engine.Rotation_EQJ_EQD(time);
   const stars=STARS.map(([name,ra,dec,mag])=>{
     const v=new engine.Vector(Math.cos(dec*RAD)*Math.cos(ra*15*RAD),Math.cos(dec*RAD)*Math.sin(ra*15*RAD),Math.sin(dec*RAD),time);
     const eq=engine.EquatorFromVector(engine.RotateVector(rotation,v));
     const h=engine.Horizon(time,obs,eq.ra,eq.dec,'normal');
     return {name,kind:'Star',mag,alt:h.altitude,az:h.azimuth};
   });
   const bodies=BODIES.map(name=>{
     const e=engine.Equator(name,time,obs,true,true),h=engine.Horizon(time,obs,e.ra,e.dec,'normal');
     return {name,kind:name==='Sun'?'Sun':name==='Moon'?'Moon':'Planet',alt:h.altitude,az:h.azimuth};
   });
   return {stars,bodies,sunAlt:bodies[0].alt};
 }
 function mount(win,doc){
   const panel=doc.getElementById('my-sky-panel'),sky=doc.getElementById('sky-view'),svg=doc.getElementById('my-sky-chart'),
     status=doc.getElementById('my-sky-status'),when=doc.getElementById('my-sky-time-label'),slider=doc.getElementById('my-sky-time'),
     now=doc.getElementById('my-sky-now'),gps=doc.getElementById('my-sky-gps'),earth=doc.getElementById('my-sky-earth'),
     detail=doc.getElementById('my-sky-detail'),list=doc.getElementById('my-sky-objects');
   if(!panel||!sky||!svg||!status||!when||!slider||!now||!gps||!earth||!detail||!list)return null;
   let point=null,offset=0,timer=null,manual=false,chosen=null,gpsSeq=0;
   const visible=()=>!sky.hidden&&!panel.hidden;
   function earthPoint(){const p=win.HereNowAppContext?.()||win.HereNowMap?.getView?.();return valid(p)?{...p,name:p.name||'Earth map centre (not GPS)',kind:p.kind||'map centre'}:null;}
   function node(tag,attrs,parent,text){
     const el=doc.createElementNS('http://www.w3.org/2000/svg',tag);
     for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));
     if(text!==undefined)el.textContent=text;parent.appendChild(el);return el;
   }
   function selected(o){
     chosen=o.name;
     const eye=['Uranus','Neptune'].includes(o.name)?' Usually requires optical aid.':'';
     detail.textContent=o.name+' · '+o.kind+' · '+Math.round(o.alt)+'° above horizon · '+direction(o.az)+' (azimuth '+Math.round(mod(o.az))+'°).'+eye;
   }
   function render(){
     if(!visible())return;
     if(!manual)point=earthPoint();
     if(!point){status.textContent='Choose a location on Earth or use GPS.';return;}
     const date=new Date(Date.now()+offset*60000);
     when.textContent=date.toLocaleString(undefined,{weekday:'short',hour:'2-digit',minute:'2-digit',month:'short',day:'numeric'});
     status.textContent='Observer: '+point.name+' · '+point.lat.toFixed(2)+'°, '+point.lon.toFixed(2)+'° · device time zone.';
     let model;try{model=skyObjects(win.Astronomy,point,date);}catch(error){
       detail.textContent='Sky calculation unavailable: '+String(error?.message||error);return;
     }
     svg.replaceChildren();
     const sun=model.sunAlt,day=sun>=0;
     const shade=day?'#25496b':sun>-6?'#1b3455':sun>-18?'#101d38':'#080f22';
     node('circle',{cx:180,cy:180,r:147,fill:shade,stroke:'#85a7c2','stroke-width':1.3},svg);
     for(const alt of [30,60])node('circle',{cx:180,cy:180,r:(90-alt)/90*147,fill:'none',stroke:'#a1bbd3','stroke-opacity':.23,'stroke-dasharray':'2 4'},svg);
     for(const [s,x,y] of [['N',180,21],['S',180,350],['E',15,184],['W',345,184]])node('text',{x,y,'text-anchor':'middle',fill:'#c4d7e9','font-size':12},svg,s);
     node('text',{x:180,y:176,'text-anchor':'middle',fill:'#a1bbd3','font-size':8},svg,'ZENITH');
     const objects=[...model.stars,...model.bodies].filter(o=>project(o.alt,o.az));
     const byName=new Map(objects.map(o=>[o.name,o]));
     if(!day)for(const [label,...paths] of GUIDES)for(const path of paths){
       for(let i=1;i<path.length;i++){const a=byName.get(path[i-1]),b=byName.get(path[i]);if(!a||!b)continue;
         const p=project(a.alt,a.az),q=project(b.alt,b.az);
         node('line',{x1:p.x,y1:p.y,x2:q.x,y2:q.y,stroke:'#8daacb','stroke-opacity':.45,'stroke-width':.8},svg);
       }
     }
     const shown=objects.filter(o=>!day||o.kind!=='Star'||o.mag<=.2);
     for(const o of shown){
       const p=project(o.alt,o.az),isStar=o.kind==='Star';
       const group=node('g',{'data-name':o.name},svg);
       const color=o.name==='Sun'?'#ffd66b':o.name==='Moon'?'#eee9d5':isStar?'#f1f5ff':'#ffb77c';
       const radius=isStar?Math.max(1.4,3.2-o.mag*.48):4.6;
       node('circle',{cx:p.x,cy:p.y,r:radius,fill:color,opacity:day&&isStar?.42:1},group);
       if(!isStar||o.mag<=1.3||o.name==='Polaris')node('text',{x:p.x+5,y:p.y-5,fill:color,'font-size':8,'paint-order':'stroke',stroke:shade,'stroke-width':2},group,o.name);
       const hit=node('circle',{cx:p.x,cy:p.y,r:9,fill:'transparent',role:'button',tabindex:0,'aria-label':o.name},group);
       hit.addEventListener('click',()=>selected(o));
       hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selected(o);}});
     }
     list.replaceChildren();
     const title=doc.createElement('option');title.value='';title.textContent='Choose an object above the horizon';list.appendChild(title);
     for(const o of shown.sort((a,b)=>a.name.localeCompare(b.name))){
       const option=doc.createElement('option');option.value=o.name;option.textContent=o.name;list.appendChild(option);
     }
     list.value=byName.has(chosen)&&shown.some(o=>o.name===chosen)?chosen:'';
     if(list.value)selected(byName.get(list.value));else detail.textContent='Tap a marker or choose an object. '+(day?'The Sun is above the horizon; most stars are not visible.':sun>-18?'Twilight: faint objects may not be visible.':'Dark-sky geometry; clouds and light pollution are not modelled.');
     list.onchange=()=>{const o=byName.get(list.value);if(o)selected(o);};
   }
   function stop(){if(timer!==null){win.clearInterval(timer);timer=null;}}
   function open(){stop();if(!visible())return;render();timer=win.setInterval(render,60000);}
   slider.addEventListener('input',()=>{offset=Number(slider.value)||0;render();});
   now.addEventListener('click',()=>{offset=0;slider.value='0';render();});
   earth.addEventListener('click',()=>{gpsSeq++;gps.disabled=false;manual=false;render();});
   gps.addEventListener('click',()=>{
     if(!win.navigator?.geolocation){status.textContent='GPS unavailable. Use Earth location instead.';return;}
     const seq=++gpsSeq;gps.disabled=true;status.textContent='Requesting GPS for the sky chart…';
     win.navigator.geolocation.getCurrentPosition(p=>{if(seq!==gpsSeq)return;gps.disabled=false;manual=true;point={lat:p.coords.latitude,lon:p.coords.longitude,name:'your GPS location'};render();},
       ()=>{if(seq!==gpsSeq)return;gps.disabled=false;status.textContent='GPS unavailable or denied. Existing Earth location retained.';},{enableHighAccuracy:false,timeout:12000,maximumAge:60000});
   });
   doc.addEventListener('visibilitychange',()=>{if(doc.hidden)stop();else open();});
   return {open,stop,render};
 }
 if(typeof module==='object'&&module.exports)module.exports={STARS,GUIDES,project,skyObjects,direction,mount};
 if(root?.document)root.HereNowMySky=mount(root,root.document);
})(typeof window==='object'?window:null);
