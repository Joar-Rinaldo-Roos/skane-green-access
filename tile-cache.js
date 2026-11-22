/* Here & Now v1.0.9 — larger MapLibre tile retention ALWAYS enabled.
 * The limit is per map source and only retains tiles already requested by MapLibre.
 * Low-memory phones retain a smaller pool to avoid memory pressure.
 */
(function(root){
 'use strict';
 function deviceClass(nav){
   if(Number.isFinite(nav?.deviceMemory)&&nav.deviceMemory<=2)return 'low';
   return /Android|iPhone|iPad|Mobile/i.test(String(nav?.userAgent||''))?'mobile':'desktop';
 }
 function tileLimit(nav){
   const device=deviceClass(nav);
   return device==='low'?80:device==='mobile'?128:224;
 }
 const api={deviceClass,tileLimit};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(!root)return;
 root.HereNowTileCache={maxTiles:()=>tileLimit(root.navigator)};
})(typeof window==='undefined'?null:window);
