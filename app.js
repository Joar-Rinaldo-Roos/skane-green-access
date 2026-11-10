/* Here & Now: client-side, sourced local discoveries. No generated trivia. */
const $=id=>document.getElementById(id);
let mode='gps',topic='surprise',selectedLocation=null,items=[],index=0,request=0;
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
  selectedLocation=null;
}
$('gps-mode').onclick=()=>selectMode('gps');$('city-mode').onclick=()=>selectMode('city');
function chooseMapCenter(){
  const center=window.HereNowMap?.getView?.();
  if(!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lon))throw Error('Map is still loading. Search for a city instead.');
  selectedLocation={lat:center.lat,lon:center.lon,name:'the map center (not GPS)'};
  window.HereNowMap?.setLocation(selectedLocation,{zoom:center.zoom||13});
  $('location-label').textContent='Using the visible map center — not your GPS position.';
  setStatus('Map center selected. Discovery does not require GPS.');
  window.HereNowDiagnostics?.log('Location','Selected map center without GPS');
  return selectedLocation;
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
async function searchCity(){const q=$('city').value.trim();if(!q)throw Error('Enter a city or place first.');setStatus('Finding '+q+'…');const res=await apiFetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=se&q='+encodeURIComponent(q),'Place search');if(!res.ok)throw Error('Place search is unavailable.');const found=await res.json();if(!found.length)throw Error('Could not find that place in Sweden.');selectedLocation={lat:+found[0].lat,lon:+found[0].lon,name:found[0].display_name.split(',').slice(0,2).join(',')};window.HereNowMap?.setLocation(selectedLocation,{zoom:13});$('location-label').textContent='Selected: '+selectedLocation.name;setStatus('')}
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
async function wikipedia(){const params=new URLSearchParams({action:'query',generator:'geosearch',ggscoord:selectedLocation.lat+'|'+selectedLocation.lon,ggsradius:'10000',ggslimit:'40',prop:'extracts|info|coordinates',inprop:'url',exintro:'1',explaintext:'1',exchars:'650',format:'json',origin:'*'});const url='https://en.wikipedia.org/w/api.php?'+params;const res=await apiFetch(url,'Wikipedia');const json=await res.json();const pages=Object.values(json.query?.pages||{});return pages.filter(p=>p.extract&&p.fullurl).map(p=>({title:p.title,text:p.extract,url:p.fullurl,category:'Wikipedia · nearby article',distance:p.coordinates?.[0]?km(selectedLocation,{lat:p.coordinates[0].lat,lon:p.coordinates[0].lon}):null})).sort((a,b)=>(a.distance??999)-(b.distance??999))}
async function nature(){const params=new URLSearchParams({lat:selectedLocation.lat,lon:selectedLocation.lon,radius:'10',per_page:'30',order_by:'observed_on',quality_grade:'research'});const res=await apiFetch('https://api.inaturalist.org/v1/observations/species_counts?'+params,'iNaturalist');const data=await res.json();return (data.results||[]).filter(r=>r.taxon?.name).map(r=>({title:r.taxon.preferred_common_name||r.taxon.name,text:'Scientific name: '+r.taxon.name+'. This species has been observed in the surrounding 10 km area on iNaturalist. This is not evidence it is present at your exact location or today.',url:'https://www.inaturalist.org/taxa/'+r.taxon.id,category:'Nature · recorded nearby',distance:null}))}
async function astronomy(){const params=new URLSearchParams({lat:selectedLocation.lat,lng:selectedLocation.lon,formatted:'0'});const res=await apiFetch('https://api.sunrise-sunset.org/json?'+params,'Sunrise-sunset');const d=await res.json();if(d.status!=='OK')throw Error('No astronomy data available.');const time=s=>new Date(s).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});return [{title:'The Sun above '+selectedLocation.name,text:'Today’s calculated sunrise is '+time(d.results.sunrise)+' and sunset is '+time(d.results.sunset)+'. Solar noon is around '+time(d.results.solar_noon)+'. These are astronomical calculations for your coordinates, not a forecast of clear skies.',url:'https://sunrise-sunset.org/api',category:'Astronomy · today',distance:null}]}
async function geologyStory(){
  const where=selectedLocation;
  window.HereNowMap?.showGeology(true);
  const feature=await window.HereNowMap?.lookupSoilAt?.(where);
  if(!feature) return [{
    title:'A blank spot in the geological record',
    text:'The SGU soil map did not return a mapped polygon covering this particular position. This does not mean there is no geology here: it means this layer cannot identify the material at this coordinate.',
    category:'Geology · source coverage',url:'https://apps.sgu.se/kartvisare/kartvisare-jordarter-25-100.html',
    meta:'Checked the selected point against the geological map'
  }];
  const raw=feature.properties?.jg2_tx||feature.properties?.jg2||'Unclassified';
  const info=window.HereNowSoil?.explain(raw);
  if(!info)throw Error('Geology explanations are still loading');
  return [{
    title:'Under this map point: '+info.title,
    text:info.material+' '+info.formation,
    category:'Geology · Swedish Geological Survey',
    url:info.source,
    deepDive:raw,
    meta:'SGU mapped soil polygon containing your selected map point'
  }];
}

function asArchiveItems(records){
  return records.map(record=>{
    const type=record.type || 'archive record';
    const introduction='An original '+type.toLowerCase()+' record catalogued by '+(record.owner||'a Swedish heritage institution')+'.';
    const original=record.description
      ? ' Original Swedish catalogue description: '+record.description.slice(0,760)
      : ' Open the original record for its full description and context.';
    return {
      title:record.name,
      text:introduction+original,
      category:record.photo?'Historical image · Swedish archives':'Heritage record · Swedish archives',
      url:record.url,
      image:record.photo||null,
      imageCredit:record.owner||'Source institution; see original record for image rights',
      meta:'Archive catalogue location approximately '+Math.round(record.distanceMeters)+' m from selected point. The mapped point may describe the subject, not the camera position.',
      distance:record.distanceMeters/1000
    };
  });
}
async function archiveStory(radius=75) {
  const service=window.HereNowArchives;
  if(!service)throw Error('The Swedish archive connection could not load');
  const records=await service.search(selectedLocation,radius);
  if(records.length)return asArchiveItems(records);
  return [{
    title:'No catalogued archive record within '+radius+' metres',
    text:'The Swedish heritage search found no geolocated record in this small area. That is not evidence that nothing happened here; many historical photos and documents lack precise coordinates. You can widen the search deliberately, or choose Geology to examine what lies beneath this place.',
    category:'History · local archive search',
    url:service.source,
    meta:'Search radius '+radius+' m · no distant landmark substituted',
    expandable:radius<250
  }];
}
function show(){
  const p=items[index];
  $('setup').hidden=true;
  $('discovery').hidden=false;
  $('category').textContent=p.category;
  $('fact-title').textContent=p.title;
  $('fact-text').textContent=p.text;
  $('fact-meta').textContent=p.meta || (p.distance!=null ? 'Approximately '+Math.round(p.distance*1000)+' m away · ':'')+'Near '+selectedLocation.name;
  $('source').href=p.url;
  const figure=$('discovery-photo-wrap');
  const photo=$('discovery-photo');
  figure.hidden=!p.image;
  if(p.image){
    photo.src=p.image;
    photo.alt='Archive thumbnail for '+p.title;
    $('discovery-photo-caption').textContent=(p.imageCredit||'Historical archive')+' · Open original record for image rights and full context.';
  }else photo.removeAttribute('src');
  const dive=$('discovery-deep-dive');
  dive.replaceChildren();
  dive.hidden=!p.deepDive;
  if(p.deepDive && window.HereNowSoil?.createCard) dive.appendChild(window.HereNowSoil.createCard(p.deepDive));
  $('expand-archive').hidden=!p.expandable;
  $('result-status').textContent=items.length>1?'Discovery '+(index+1)+' of '+items.length:'One discovery available';
  window.scrollTo({top:0,behavior:'smooth'});
}
async function discover(){
  const id=++request;
  $('discover').disabled=true;
  setStatus('Finding your selected position…');
  try{
    if(mode==='gps'){if(!selectedLocation)selectedLocation=await gps();}
    else if(mode==='map'){if(!selectedLocation)chooseMapCenter();}
    else if(!selectedLocation)await searchCity();
    window.HereNowMap?.setLocation(selectedLocation,{zoom:mode==='gps'?15:13});
    if(topic==='geology'){
      setStatus('Checking SGU geology at this map point…');
      items=await geologyStory();
    } else if(topic==='history'||topic==='culture'){
      setStatus('Searching Swedish heritage records within 75 metres…');
      items=await archiveStory(75);
      if(topic==='culture')items.sort((a,b)=>Number(!!b.image)-Number(!!a.image));
    } else if(topic==='surprise'){
      setStatus('Looking for an archive story at this spot…');
      try{
        const archive=await archiveStory(75);
        // The same place always has geology even if it has no geotagged archive photo.
        items=archive[0]?.expandable ? await geologyStory() : archive;
        if(items.length>1)items.sort(()=>Math.random()-.5);
      }catch(error){
        window.HereNowDiagnostics?.log('Discover','Archive unavailable; trying local geology: '+error.message);
        items=await geologyStory();
      }
    } else {
      setStatus('Searching original sources near '+selectedLocation.name+'…');
      items=topic==='nature'?await nature():await astronomy();
    }
    if(id!==request)return;
    if(!items.length)throw Error('No verified discovery returned for this point.');
    index=0;show();
  }catch(e){
    window.HereNowDiagnostics?.log('Discover',e.message);
    setStatus(e.message+'. You can choose Map center instead of GPS.');
  }finally{$('discover').disabled=false;}
}
$('discover').onclick=discover;
$('expand-archive').onclick=async()=>{
  if(!selectedLocation)return;
  const button=$('expand-archive');
  button.disabled=true;
  $('result-status').textContent='Searching records within 250 metres…';
  try{
    items=await archiveStory(250);
    index=0;show();
  }catch(e){
    $('result-status').textContent=e.message;
    window.HereNowDiagnostics?.log('Archives',e.message);
  }finally{button.disabled=false;}
};
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
    selectedLocation=point;
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
