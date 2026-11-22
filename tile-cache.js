/* Here & Now v1.0.8 — bounded MapLibre tile-cache sizing.
 * Cache is in MapLibre memory, PER SOURCE, not a persistent download store.
 * More caching helps revisit the same geographic area; it does not download
 * all weather forecast hours, fetch extra raster tiles or bypass server limits. */
(function(root){
 'use strict';
 const KEY='here-now:larger-map-cache:v1';
 function deviceClass(nav){
   if(Number.isFinite(nav?.deviceMemory)&&nav.deviceMemory<=2)return 'low';
   return /Android|iPhone|iPad|Mobile/i.test(String(nav?.userAgent||''))?'mobile':'desktop';
 }
 function tileLimit(extra,nav){
   const device=deviceClass(nav);
   if(device==='low')return extra?80:48;
   if(device==='mobile')return extra?128:72;
   return extra?224:128;
 }
 function readExtra(storage){
   try{return storage?.getItem(KEY)==='true';}catch(error){return false;}
 }
 function saveExtra(storage,enabled){
   try{storage?.setItem(KEY,String(Boolean(enabled)));return true;}catch(error){return false;}
 }
 const api={KEY,deviceClass,tileLimit,readExtra,saveExtra};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(!root)return;
 const more=document.getElementById('tile-cache-extra');
 const detail=document.getElementById('tile-cache-detail');
 let extra=readExtra(root.localStorage);
 function update(){
   if(more)more.checked=extra;
   if(detail)detail.textContent=
     'MapLibre retains up to '+tileLimit(extra,root.navigator)+' recent tiles per map source in memory. '+
     'This does not preload the world or store weather tiles offline.';
 }
 root.HereNowTileCache={maxTiles:()=>tileLimit(extra,root.navigator),isExtra:()=>extra};
 more?.addEventListener('change',()=>{
   extra=Boolean(more.checked);
   saveExtra(root.localStorage,extra);
   update();
   // Tile cache size is chosen at MapLibre construction; reload is required.
   if(detail)detail.textContent+=' Reload the page to apply this cache size.';
 });
 update();
})(typeof window==='undefined'?null:window);
