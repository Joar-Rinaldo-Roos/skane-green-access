/* A mobile-friendly SIMBAD cone lookup, independent of Aladin's internal pointer UI. */
(function(root){
 'use strict';
 const BASES=['https://simbad.cfa.harvard.edu/simbad/','https://simbad.idia.ac.za/simbad/','https://simbad.cds.unistra.fr/simbad/'];
 const num=v=>typeof v==='number'&&Number.isFinite(v);
 const TYPES={'*':'Star','**':'Double or multiple star','V*':'Variable star','G':'Galaxy','QSO':'Quasar','Cl*':'Star cluster','GlC':'Globular cluster','OpC':'Open cluster','PN':'Planetary nebula','HII':'Ionized hydrogen region','SNR':'Supernova remnant','Psr':'Pulsar','Neb':'Nebula','BH':'Black hole','Y*O':'Young stellar object'};
 function queryURL(base,ra,dec,radius){
   if(!num(ra)||!num(dec)||!num(radius)||dec<-90||dec>90||radius<=0||radius>0.5)throw Error('Invalid sky coordinates');
   ra=((ra%360)+360)%360;
   const q='SELECT TOP 1 basic.main_id, basic.ra, basic.dec, basic.nbref, basic.otype, allfluxes.B FROM basic LEFT OUTER JOIN allfluxes ON basic.oid = allfluxes.oidref WHERE CONTAINS(POINT('+"'ICRS'"+', basic.ra, basic.dec), CIRCLE('+"'ICRS'"+', '+ra+', '+dec+', '+radius+')) = 1 ORDER BY nbref DESC';
   return base+'sim-tap/sync?'+new URLSearchParams({REQUEST:'doQuery',LANG:'ADQL',FORMAT:'json',QUERY:q});
 }
 function parse(data){
   if(!Array.isArray(data?.data))throw Error('Invalid SIMBAD response');
   if(!data.data.length)return null;
   const row=data.data[0];
   if(!Array.isArray(row)||row.length<6||typeof row[0]!=='string'||!num(row[1])||!num(row[2]))throw Error('Invalid SIMBAD row');
   return {id:row[0].trim(),ra:row[1],dec:row[2],references:row[3],type:row[4],magnitude:row[5]};
 }
 async function lookup(win,ra,dec,radius,signal){
   for(const base of BASES){
     if(signal.aborted)throw Error('Cancelled');
     const controller=new AbortController();
     const cancel=()=>controller.abort();signal.addEventListener('abort',cancel,{once:true});
     const timer=win.setTimeout(cancel,7000);
     try{
       const response=await win.fetch(queryURL(base,ra,dec,radius),{signal:controller.signal,credentials:'omit'});
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
     facts=doc.getElementById('sky-object-facts'),link=doc.getElementById('sky-object-link');
   if(!button||!card||!title||!description||!facts||!link||!atlas?.pix2world)return null;
   let enabled=false,start=null,active=null;
   button.disabled=false;
   function render(heading,body,details='',url=null){
     card.hidden=false;title.textContent=heading;description.textContent=body;facts.textContent=details;
     link.hidden=!url;if(url)link.href=url;else link.removeAttribute('href');
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
       const kind=TYPES[result.type]||('Catalogue type: '+(result.type||'unknown'));
       const detail=['RA '+result.ra.toFixed(5)+'° · Dec '+result.dec.toFixed(5)+'°'];
       if(num(result.magnitude))detail.push('B-band magnitude '+result.magnitude.toFixed(2));
       if(num(result.references))detail.push(result.references+' bibliographic references');
       render(result.id,kind+' · Most referenced catalogue match near your tap (not necessarily the exact visible object).',detail.join(' · '),
         base+'sim-id?'+new URLSearchParams({Ident:result.id}));
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
 if(typeof module==='object'&&module.exports)module.exports={queryURL,parse,lookup,mount};
 if(root?.document)root.HereNowSimbad={mount};
})(typeof window==='object'?window:null);
