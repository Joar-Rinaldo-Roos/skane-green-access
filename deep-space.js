/* Lazy-loaded Aladin Lite sky atlas. No GPS or new backend required. */
(function(root){
 'use strict';
 const URL='https://aladin.cds.unistra.fr/AladinLite/api/v3/latest/aladin.js';
 function mount(win,doc){
   const deep=doc.getElementById('sky-deep-space'),my=doc.getElementById('sky-my-sky');
   const deepPanel=doc.getElementById('deep-space-panel'),myPanel=doc.getElementById('my-sky-panel');
   const host=doc.getElementById('deep-space-atlas'),status=doc.getElementById('deep-space-status');
   const retry=doc.getElementById('deep-space-retry'),sky=doc.getElementById('sky-view');
   if(!deep||!my||!deepPanel||!myPanel||!host||!status||!retry||!sky)return null;
   let mode='my',atlas=null,pending=null,library=null;
   function visible(){return !sky.hidden&&mode==='deep';}
   function loadLibrary(){
     if(win.A?.init)return Promise.resolve(win.A);
     if(library)return library;
     library=new Promise((resolve,reject)=>{
       const script=doc.createElement('script');script.src=URL;script.async=true;
       const timer=win.setTimeout(()=>fail('Aladin Lite script timed out'),25000);
       function fail(message){win.clearTimeout(timer);script.remove();reject(Error(message));}
       script.onerror=()=>fail('Aladin Lite script could not load');
       script.onload=()=>{win.clearTimeout(timer);if(win.A?.init)resolve(win.A);else fail('Aladin Lite API unavailable');};
       doc.head.appendChild(script);
     }).catch(error=>{library=null;throw error;});
     return library;
   }
   function initialize(){
     if(!visible()||atlas||pending)return pending;
     retry.hidden=true;status.textContent='Loading astronomical atlas…';
     pending=(async()=>{
       const A=await loadLibrary();
       await A.init;
       // The user may have returned to Earth while the library loaded.
       if(!visible())return;
       atlas=A.aladin('#deep-space-atlas',{
         survey:'P/DSS2/color',target:'266.41683 -29.00781',fov:60,
         cooFrame:'ICRS',showCooGrid:false,showCooGridControl:true,
         showSimbadPointerControl:false,showLayersControl:true,
         showFullscreenControl:true,showReticle:false
       });
       win.HereNowSimbad?.mount(win,doc,atlas,host);
       status.textContent='Explore real telescope surveys. Drag, pinch or zoom; tap Identify object to look up an astronomical object.';
     })().catch(error=>{
       status.textContent='Deep space could not start. Try again or open the original Aladin Lite website.';
       retry.hidden=false;
       win.HereNowDiagnostics?.log('Deep space',String(error?.message||error));
     }).finally(()=>{pending=null;});
     return pending;
   }
   function select(next){
     mode=next;deepPanel.hidden=next!=='deep';myPanel.hidden=next!=='my';
     deep.setAttribute('aria-pressed',String(next==='deep'));
     my.setAttribute('aria-pressed',String(next==='my'));
     if(next==='deep'){win.HereNowMySky?.stop?.();return initialize();}
     win.HereNowMySky?.open?.();
   }
   deep.addEventListener('click',()=>select('deep'));
   my.addEventListener('click',()=>select('my'));
   retry.addEventListener('click',initialize);
   return {open:()=>{if(mode==='deep')return initialize();win.HereNowMySky?.open?.();},select};
 }
 if(typeof module==='object'&&module.exports)module.exports={mount,URL};
 if(root?.document)root.HereNowDeepSpace=mount(root,root.document);
})(typeof window==='object'?window:null);
