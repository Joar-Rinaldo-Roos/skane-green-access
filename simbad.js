/* A mobile-friendly SIMBAD cone lookup, independent of Aladin's internal pointer UI. */
(function(root){
 'use strict';
 const BASES=['https://simbad.cfa.harvard.edu/simbad/','https://simbad.idia.ac.za/simbad/','https://simbad.cds.unistra.fr/simbad/'];
 const num=v=>typeof v==='number'&&Number.isFinite(v);
 const TYPES={'*':'Star','**':'Double or multiple star','V*':'Variable star','G':'Galaxy','QSO':'Quasar','Cl*':'Star cluster','GlC':'Globular cluster','OpC':'Open cluster','PN':'Planetary nebula','HII':'Ionized hydrogen region','SNR':'Supernova remnant','Psr':'Pulsar','Neb':'Nebula','BH':'Black hole','Y*O':'Young stellar object'};

 const EXPLAIN={
   'LXB':['Low-mass X-ray binary','A compact object, such as a neutron star or black hole, draws matter from a relatively low-mass companion star. Hot material can produce powerful X-rays.'],
   'HXB':['High-mass X-ray binary','A neutron star or black hole accretes material from a massive companion star, producing X-rays.'],
   'cC*':['Classical Cepheid variable star','A pulsating star that expands and contracts in a regular cycle. Astronomers use Cepheids to measure cosmic distances because their pulsation periods are related to their intrinsic brightness.'],
   'V*':['Variable star','A star whose observed brightness changes over time. The reason depends on the specific kind of variable star.'],
   '*':['Star','A luminous ball of hot plasma. Most stars produce energy through nuclear fusion in their cores.'],
   '**':['Double or multiple star','Two or more stars seen close together. Some are gravitationally bound, while others only appear close from Earth.'],
   'G':['Galaxy','A vast collection of stars, gas, dust and dark matter held together by gravity.'],
   'QSO':['Quasar','An extremely luminous active galactic nucleus powered by matter accreting onto a supermassive black hole.'],
   'GlC':['Globular cluster','A dense, roughly spherical group of stars, often containing very old stars.'],
   'OpC':['Open cluster','A relatively loose group of stars that generally formed together from the same cloud of gas.'],
   'Cl*':['Star cluster','A group of stars; many clusters contain stars that formed together.'],
   'PN':['Planetary nebula','A glowing shell of gas ejected by a dying star. Despite the name, it is not a planet.'],
   'HII':['Ionized hydrogen region','A cloud of gas lit and ionized by energetic radiation, often from nearby young hot stars.'],
   'SNR':['Supernova remnant','Expanding material left behind after a star explodes.'],
   'Psr':['Pulsar','A rapidly rotating neutron star whose radiation is detected in repeating pulses.'],
   'Neb':['Nebula','A cloud of gas or dust in space. Some glow, others reflect starlight or block light.'],
   'BH':['Black hole','An object with gravity so strong that light cannot escape from inside its event horizon.'],
   'N*':['Neutron star','An extremely dense stellar remnant formed when the core of a massive star collapses.'],
   'Y*O':['Young stellar object','A star in an early stage of formation or evolution.'],
   'X':['X-ray source','An astronomical source detected in X-rays; that label alone does not identify the physical object.'],
   'Rad':['Radio source','An astronomical source detected at radio wavelengths; this label alone does not identify its physical nature.']
 };
 function explain(result){
   const known=EXPLAIN[result.type];
   const label=known?.[0]||result.typeLabel||TYPES[result.type]||'Unclassified catalogue object';
   return {label,description:known?.[1]||'SIMBAD classifies this object as '+label.toLowerCase()+'. The available classification alone may not establish its exact physical nature.'};
 }
 function constellation(win,result){
   try{return win.Astronomy?.Constellation(result.ra/15,result.dec)?.name||null;}catch(_){return null;}
 }
 // Only invert well-measured positive parallaxes (mas). A noisy parallax is not a distance.
 function parallaxDistance(result){
   const p=result.parallax,e=result.parallaxError;
   if(!num(p)||!num(e)||p<=0||e<=0||e/p>0.2)return null;
   return {ly:3261.56/p,method:'estimated from SIMBAD parallax',bib:result.parallaxBib||null};
 }
 function publishedDistance(rows){
   const scale={pc:3.26156,kpc:3261.56,mpc:3261560,gpc:3261560000,ly:1};
   for(const row of rows||[]){
     const [v,unit,bib]=row;
     const factor=scale[String(unit).trim().toLowerCase()];
     if(num(v)&&v>0&&factor&&Number.isFinite(v*factor))return {ly:v*factor,method:'published SIMBAD distance measurement',bib:typeof bib==='string'?bib.trim():null};
   }
   return null;
 }
 function clusterLinks(rows){
   const seen=new Set(),out=[];
   for(const row of rows||[]){
     const [id,type,probability,label]=row;
     if(typeof id!=='string'||!(/^(Cl\*|GlC|OpC|ClG|GrG)$/.test(type)||/\b(cluster|group of galaxies)\b/i.test(label||'')))continue;
     if(num(probability)&&probability<=0)continue;
     const key=id.trim();if(!key||seen.has(key))continue;seen.add(key);
     out.push(key+(num(probability)?' ('+probability+'% reported membership)':' (catalogue association; confidence not listed)'));
     if(out.length>=3)break;
   }
   return out;
 }
 function tapURL(base,q){return base+'sim-tap/sync?'+new URLSearchParams({REQUEST:'doQuery',LANG:'ADQL',FORMAT:'json',QUERY:q});}
 async function optionalRows(win,base,q,signal){
   if(signal.aborted)return null;
   const controller=new AbortController(),cancel=()=>controller.abort();
   signal.addEventListener('abort',cancel,{once:true});
   const timer=win.setTimeout(cancel,5000);
   try{
     const response=await win.fetch(tapURL(base,q),{signal:controller.signal,credentials:'omit'});
     if(!response.ok)return null;
     const data=await response.json();
     return Array.isArray(data?.data)?data.data:null;
   }catch(_){return null;}
   finally{win.clearTimeout(timer);signal.removeEventListener('abort',cancel);}
 }
 async function enrich(win,base,result,signal){
   const parallax=parallaxDistance(result);
   if(!Number.isSafeInteger(result.oid)||result.oid<=0)return {distance:parallax,clusters:null};
   const oid=result.oid;
   const [dist,groups]=await Promise.all([
     parallax?Promise.resolve(null):optionalRows(win,base,'SELECT TOP 8 dist, unit, bibcode FROM mesDistance WHERE oidref = '+oid+' ORDER BY bibcode DESC',signal),
     optionalRows(win,base,'SELECT TOP 12 basic.main_id, basic.otype, h_link.membership, otypedef.description FROM h_link JOIN basic ON h_link.parent = basic.oid LEFT OUTER JOIN otypedef ON basic.otype = otypedef.otype WHERE h_link.child = '+oid+' ORDER BY h_link.membership DESC',signal)
   ]);
   return {distance:parallax||publishedDistance(dist),clusters:groups===null?null:clusterLinks(groups)};
 }
 function formatDistance(distance){
   if(!distance)return 'No reliable distance available in the retrieved data.';
   return 'About '+Number(distance.ly.toPrecision(2)).toLocaleString('en-US')+' light-years ('+distance.method+').';
 }
 function queryURL(base,ra,dec,radius,extended=true){
   if(!num(ra)||!num(dec)||!num(radius)||dec<-90||dec>90||radius<=0||radius>0.5)throw Error('Invalid sky coordinates');
   ra=((ra%360)+360)%360;
   const extra=extended?', basic.plx_value, basic.plx_err, basic.sp_type, otypedef.description, basic.oid, basic.plx_bibcode':'';
   const join=extended?' LEFT OUTER JOIN otypedef ON basic.otype = otypedef.otype':'';
   const q='SELECT TOP 1 basic.main_id, basic.ra, basic.dec, basic.nbref, basic.otype, allfluxes.B'+extra+' FROM basic LEFT OUTER JOIN allfluxes ON basic.oid = allfluxes.oidref'+join+' WHERE CONTAINS(POINT('+"'ICRS'"+', basic.ra, basic.dec), CIRCLE('+"'ICRS'"+', '+ra+', '+dec+', '+radius+')) = 1 ORDER BY nbref DESC';
   return base+'sim-tap/sync?'+new URLSearchParams({REQUEST:'doQuery',LANG:'ADQL',FORMAT:'json',QUERY:q});
 }
 function parse(data){
   if(!Array.isArray(data?.data))throw Error('Invalid SIMBAD response');
   if(!data.data.length)return null;
   const row=data.data[0];
   if(!Array.isArray(row)||row.length<6||typeof row[0]!=='string'||!num(row[1])||!num(row[2]))throw Error('Invalid SIMBAD row');
   const result={id:row[0].trim(),ra:row[1],dec:row[2],references:row[3],type:row[4],magnitude:row[5]};
   if(row.length>=12)Object.assign(result,{parallax:row[6],parallaxError:row[7],spectral:row[8],typeLabel:typeof row[9]==='string'?row[9].trim():null,oid:row[10],parallaxBib:row[11]});
   return result;
 }
 async function lookup(win,ra,dec,radius,signal){
   for(const base of BASES){
     if(signal.aborted)throw Error('Cancelled');
     const controller=new AbortController();
     const cancel=()=>controller.abort();signal.addEventListener('abort',cancel,{once:true});
     const timer=win.setTimeout(cancel,7000);
     try{
       let response=await win.fetch(queryURL(base,ra,dec,radius),{signal:controller.signal,credentials:'omit'});
       if(response.status===400||response.status===422)response=await win.fetch(queryURL(base,ra,dec,radius,false),{signal:controller.signal,credentials:'omit'});
       if(!response.ok)throw Error('SIMBAD HTTP '+response.status);
       const result=parse(await response.json());
       if(signal.aborted)throw Error('Cancelled');
       return {result,base};
     }catch(error){if(signal.aborted)throw error;}
     finally{win.clearTimeout(timer);signal.removeEventListener('abort',cancel);}
   }
   throw Error('SIMBAD mirrors unavailable');
 }
 function mount(win,doc,atlas,host){
   const button=doc.getElementById('identify-sky-object'),card=doc.getElementById('sky-object-card'),
     title=doc.getElementById('sky-object-title'),description=doc.getElementById('sky-object-description'),
     facts=doc.getElementById('sky-object-facts'),raw=doc.getElementById('sky-object-technical'),note=doc.getElementById('sky-object-note'),link=doc.getElementById('sky-object-link');
   if(!button||!card||!title||!description||!facts||!raw||!note||!link||!atlas?.pix2world)return null;
   let enabled=false,start=null,active=null;
   button.disabled=false;
   function render(heading,body,details='',url=null,technical='',caution=''){
     card.hidden=false;title.textContent=heading;description.textContent=body;facts.textContent=details;
     raw.textContent=technical;note.textContent=caution;link.hidden=!url;if(url)link.href=url;else link.removeAttribute('href');
   }
   function setEnabled(on){
     enabled=on;button.setAttribute('aria-pressed',String(on));button.classList.toggle('layer-active',on);
     if(on)render('Identify an object','Tap a star, nebula or galaxy in the atlas. Zoom in for a more precise match.');
     else{active?.abort();active=null;start=null;}
   }
   button.addEventListener('click',()=>setEnabled(!enabled));
   async function identify(x,y){
     active?.abort();const controller=new AbortController();active=controller;
     let p,radius;
     try{
       p=atlas.pix2world(x,y,'ICRS');
       const fov=atlas.getFov?.()?.[0];
       radius=Math.max(0.0003,Math.min(0.5,(num(fov)?fov:1)*6/Math.max(host.clientWidth,1)));
       if(!Array.isArray(p)||!num(p[0])||!num(p[1]))throw Error('Outside sky projection');
     }catch(_){render('No sky coordinate','Tap inside the astronomical image.');return;}
     render('Looking up object…','Querying the SIMBAD astronomical catalogue.');
     try{
       const {result,base}=await lookup(win,p[0],p[1],radius,controller.signal);
       if(active!==controller||controller.signal.aborted)return;
       if(!result){render('No catalogue match','SIMBAD found no object in this search area. Try zooming or selecting another point.');return;}
       const info=explain(result),region=constellation(win,result);
       const detail=['RA '+result.ra.toFixed(5)+'° · Dec '+result.dec.toFixed(5)+'°'];
       if(num(result.magnitude))detail.push('B-band magnitude '+result.magnitude.toFixed(2));
       if(num(result.references))detail.push(result.references+' bibliographic references');
       if(result.spectral)detail.push('Spectral type '+result.spectral);
       if(result.type)detail.push('SIMBAD type code '+result.type);
       const url=base+'sim-id?'+new URLSearchParams({Ident:result.id});
       const heading=result.id.replace(/^V\*\s+/,'');
       const body=info.label+'\n\n'+info.description;
       const context=['Constellation: '+(region||'Not available')];
       const initial=parallaxDistance(result);
       const caution='Catalogue match near your tap, selected by reference count. Not necessarily the exact visible object. Constellation is an apparent sky region, not physical cluster membership.';
       render(heading,body,[...context,'Distance: '+(initial?formatDistance(initial):'Checking catalogue…'),'Cluster/group: Checking catalogue…'].join('\n'),url,detail.join('\n'),caution);
       const extra=await enrich(win,base,result,controller.signal);
       if(active!==controller||controller.signal.aborted)return;
       context.push('Distance: '+formatDistance(extra.distance));
       if(extra.distance?.bib)detail.push('Distance source: '+extra.distance.bib);
       context.push('Cluster/group: '+(extra.clusters?.length?extra.clusters.join('; '):'No verified association in retrieved records.'));
       render(heading,body,context.join('\n'),url,detail.join('\n'),caution);
     }catch(error){
       if(active!==controller||controller.signal.aborted)return;
       render('SIMBAD unavailable','The catalogue did not respond. Tap another object or try again later.');
       win.HereNowDiagnostics?.log('SIMBAD',String(error?.message||error));
     }
   }
   // Observe canvas gestures only; do not consume Aladin's pan, pinch or zoom events.
   host.addEventListener('pointerdown',e=>{
     if(!enabled)return;
     if(!e.isPrimary){start=null;return;}
     if(e.button!==0||e.target.tagName!=='CANVAS')return;
     start={id:e.pointerId,x:e.clientX,y:e.clientY};
   },true);
   host.addEventListener('pointercancel',()=>{start=null;},true);
   host.addEventListener('pointerup',e=>{
     const s=start;start=null;
     if(!enabled||!s||s.id!==e.pointerId||Math.hypot(e.clientX-s.x,e.clientY-s.y)>7)return;
     const bounds=host.getBoundingClientRect();
     identify(e.clientX-bounds.left,e.clientY-bounds.top);
   },true);
   return {identify,setEnabled};
 }
 if(typeof module==='object'&&module.exports)module.exports={queryURL,parse,lookup,mount,explain,parallaxDistance,publishedDistance,clusterLinks,constellation,enrich};
 if(root?.document)root.HereNowSimbad={mount};
})(typeof window==='object'?window:null);
