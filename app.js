/* Here & Now: client-side, sourced local discoveries. No generated trivia. */
const $=id=>document.getElementById(id);
let mode='gps',topic='surprise',location=null,items=[],index=0,request=0;
const setStatus=s=>$('status').textContent=s;
const rad=x=>x*Math.PI/180;
function km(a,b){const dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);const q=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 12742*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))}
function selectMode(next){
  if(mode===next)return;
  mode=next;
  window.HereNowMap?.clearLocation();
  for(const [id,value] of [['gps-mode','gps'],['city-mode','city'],['map-mode','map']]){
    $(id).classList.toggle('selected',mode===value);
    $(id).setAttribute('aria-pressed',String(mode===value));
  }
  $('city-box').hidden=mode!=='city';
  $('location-label').textContent=mode==='gps'?'Tap Find me or Discover to request GPS permission.':mode==='city'?'Search for a Swedish city or place.':'Explore the center of the visible map without GPS.';
  location=null;
}
$('gps-mode').onclick=()=>selectMode('gps');$('city-mode').onclick=()=>selectMode('city');
function chooseMapCenter(){
  const center=window.HereNowMap?.getView?.();
  if(!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lon))throw Error('Map is still loading. Search for a city instead.');
  location={lat:center.lat,lon:center.lon,name:'the map center (not GPS)'};
  window.HereNowMap?.setLocation(location,{zoom:center.zoom||13});
  $('location-label').textContent='Using the visible map center — not your GPS position.';
  setStatus('Map center selected. Discovery does not require GPS.');
  window.HereNowDiagnostics?.log('Location','Selected map center without GPS');
  return location;
}
$('map-mode').onclick=()=>{selectMode('map');try{chooseMapCenter()}catch(e){setStatus(e.message)}};
async function apiFetch(url,source){
  window.HereNowDiagnostics?.log('API',source+' request started');
  try{
    const response=await fetch(url);
    window.HereNowDiagnostics?.log('API',source+' HTTP '+response.status);
    if(!response.ok)throw Error('HTTP '+response.status);
    return response;
  }catch(error){
    window.HereNowDiagnostics?.log('API',source+' failed: '+error.message);
    throw Error(source+' is unavailable ('+error.message+'). Try another topic or use the diagnostics report.');
  }
}
document.querySelectorAll('.topic').forEach(b=>b.onclick=()=>{topic=b.dataset.topic;document.querySelectorAll('.topic').forEach(x=>{const yes=x===b;x.classList.toggle('selected',yes);x.setAttribute('aria-pressed',String(yes))})});
async function searchCity(){const q=$('city').value.trim();if(!q)throw Error('Enter a city or place first.');setStatus('Finding '+q+'…');const res=await apiFetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=se&q='+encodeURIComponent(q),'Place search');if(!res.ok)throw Error('Place search is unavailable.');const found=await res.json();if(!found.length)throw Error('Could not find that place in Sweden.');location={lat:+found[0].lat,lon:+found[0].lon,name:found[0].display_name.split(',').slice(0,2).join(',')};window.HereNowMap?.setLocation(location,{zoom:13});$('location-label').textContent='Selected: '+location.name;setStatus('')}
$('find-city').onclick=()=>searchCity().catch(e=>setStatus(e.message));$('city').onkeydown=e=>{if(e.key==='Enter')searchCity().catch(err=>setStatus(err.message))};
function gps(){return new Promise((resolve,reject)=>{
  if(!window.isSecureContext)return reject(Error('GPS requires HTTPS. Choose Map center.'));
  if(!navigator.geolocation)return reject(Error('GPS is unavailable in this browser. Choose Map center.'));
  window.HereNowDiagnostics?.log('GPS','Requested position / permission');
  navigator.geolocation.getCurrentPosition(p=>{
    window.HereNowDiagnostics?.log('GPS','Position received (coordinates omitted)');
    resolve({lat:p.coords.latitude,lon:p.coords.longitude,name:'your location',accuracy:p.coords.accuracy});
  },e=>{
    const message=e.code===1?'Location denied or blocked. In Chrome site settings allow Location, or select Map center.':e.code===2?'GPS location unavailable. Enable phone location services, or select Map center.':e.code===3?'GPS timed out. Retry outside, or select Map center.':'Location could not be found. Select Map center.';
    window.HereNowDiagnostics?.log('GPS','Error code '+e.code);
    reject(Error(message));
  },{enableHighAccuracy:false,timeout:15000,maximumAge:120000});
})}
async function wikipedia(){const params=new URLSearchParams({action:'query',generator:'geosearch',ggscoord:location.lat+'|'+location.lon,ggsradius:'10000',ggslimit:'40',prop:'extracts|info|coordinates',inprop:'url',exintro:'1',explaintext:'1',exchars:'650',format:'json',origin:'*'});const url='https://en.wikipedia.org/w/api.php?'+params;const res=await apiFetch(url,'Wikipedia');const json=await res.json();const pages=Object.values(json.query?.pages||{});return pages.filter(p=>p.extract&&p.fullurl).map(p=>({title:p.title,text:p.extract,url:p.fullurl,category:'Wikipedia · nearby article',distance:p.coordinates?.[0]?km(location,{lat:p.coordinates[0].lat,lon:p.coordinates[0].lon}):null})).sort((a,b)=>(a.distance??999)-(b.distance??999))}
async function nature(){const params=new URLSearchParams({lat:location.lat,lon:location.lon,radius:'10',per_page:'30',order_by:'observed_on',quality_grade:'research'});const res=await apiFetch('https://api.inaturalist.org/v1/observations/species_counts?'+params,'iNaturalist');const data=await res.json();return (data.results||[]).filter(r=>r.taxon?.name).map(r=>({title:r.taxon.preferred_common_name||r.taxon.name,text:'Scientific name: '+r.taxon.name+'. This species has been observed in the surrounding 10 km area on iNaturalist. This is not evidence it is present at your exact location or today.',url:'https://www.inaturalist.org/taxa/'+r.taxon.id,category:'Nature · recorded nearby',distance:null}))}
async function astronomy(){const params=new URLSearchParams({lat:location.lat,lng:location.lon,formatted:'0'});const res=await apiFetch('https://api.sunrise-sunset.org/json?'+params,'Sunrise-sunset');const d=await res.json();if(d.status!=='OK')throw Error('No astronomy data available.');const time=s=>new Date(s).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});return [{title:'The Sun above '+location.name,text:'Today’s calculated sunrise is '+time(d.results.sunrise)+' and sunset is '+time(d.results.sunset)+'. Solar noon is around '+time(d.results.solar_noon)+'. These are astronomical calculations for your coordinates, not a forecast of clear skies.',url:'https://sunrise-sunset.org/api',category:'Astronomy · today',distance:null}]}
function show(){const p=items[index];$('setup').hidden=true;$('discovery').hidden=false;$('category').textContent=p.category;$('fact-title').textContent=p.title;$('fact-text').textContent=p.text;$('fact-meta').textContent=(p.distance!=null?'Approximately '+p.distance.toFixed(1)+' km away · ':'')+'Near '+location.name;$('source').href=p.url;$('result-status').textContent=items.length>1?'Discovery '+(index+1)+' of '+items.length:'One discovery available';window.scrollTo({top:0,behavior:'smooth'})}
async function discover(){const id=++request;$('discover').disabled=true;setStatus('Getting your location…');try{if(mode==='gps'){if(!location)location=await gps();}else if(mode==='map'){if(!location)chooseMapCenter();}else if(!location)await searchCity();window.HereNowMap?.setLocation(location,{zoom:mode==='gps'?15:13});if(topic==='geology'){window.HereNowMap?.showGeology(true);items=[{title:'Explore the soil geology map',text:'The overlay above shows SGU’s mapped near-surface soil units near this place. Pan and zoom to explore it. This map is a visualization, not a point-specific geological interpretation; reliable feature queries and explanations are planned for a later phase.',url:'https://www.sgu.se/produkter-och-tjanster/geologiska-data/jordarter--geologiska-data/jordartsdata/',category:'Geology · SGU map layer',distance:null}];}else{setStatus('Searching real sources near '+location.name+'…');items=topic==='nature'?await nature():topic==='astronomy'?await astronomy():await wikipedia();}if(id!==request)return;if(!items.length)throw Error('No sourced discoveries found nearby. Try another topic or location.');if(topic==='surprise')items=items.sort(()=>Math.random()-.5);index=0;show()}catch(e){window.HereNowDiagnostics?.log('Discover',e.message);setStatus(e.message+' You can select Map center instead of GPS.')}finally{$('discover').disabled=false}}
$('discover').onclick=discover;
$('another').onclick=()=>{if(items.length>1){index=(index+1)%items.length;show()}else $('result-status').textContent='Only one result is available for this location and topic.'};
$('back').onclick=()=>{$('discovery').hidden=true;$('setup').hidden=false;window.scrollTo(0,0)};

/* Map's Find me control uses the same one-shot GPS request as Discover. */
$('locate').onclick=async()=>{
  const button=$('locate');
  button.disabled=true;
  selectMode('gps');
  window.HereNowMap?.setStatus('Requesting your GPS position…');
  try{
    const point=await gps();
    if(mode!=='gps')return;
    location=point;
    window.HereNowMap?.setLocation(point,{zoom:15});
    $('location-label').textContent='GPS location selected. Discover to explore nearby.';
    setStatus('GPS position found.');
  }catch(e){
    window.HereNowDiagnostics?.log('Find me',e.message);
    window.HereNowMap?.setStatus(e.message);
    setStatus(e.message);
  }finally{
    button.disabled=false;
  }
};
