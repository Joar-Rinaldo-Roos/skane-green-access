/* Mobile-first outdoor discovery using OSM Overpass and Nominatim. No API keys. */
const $ = id => document.getElementById(id);
const map = L.map('map', {zoomControl:true}).setView([59.33,18.06], 6);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
const markers = L.layerGroup().addTo(map);
let center = null, places = [], savedOnly = false, requestId = 0;
const stored = (()=>{try{return JSON.parse(localStorage.getItem('outdoor-saved')||'{}')}catch{return {}}})();
const setStatus = s => $('status').textContent=s;
const radians = d=>d*Math.PI/180;
function distance(a,b){const dLat=radians(b.lat-a.lat),dLon=radians(b.lon-a.lon);const q=Math.sin(dLat/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(dLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))}
const categories={nature:'🌿 Nature reserve',water:'🏊 Swimming spot',view:'⛰️ Viewpoint'};
function classify(t){if(t.leisure==='bathing_place'||t.sport==='swimming'||t.natural==='beach')return 'water';if(t.tourism==='viewpoint')return 'view';return 'nature'}
function persist(){try{localStorage.setItem('outdoor-saved',JSON.stringify(stored))}catch{setStatus('Browser storage is unavailable. Saved places may not persist.')}}
function escapeText(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function render(){
 const kind=$('kind').value;
 const shown=(savedOnly?Object.values(stored):places).filter(p=>kind==='all'||p.kind===kind).sort((a,b)=>(a.km??999)-(b.km??999));
 $('count').textContent='('+shown.length+')';$('saved-toggle').textContent=savedOnly?'★ Saved only':'☆ Saved';$('saved-toggle').setAttribute('aria-pressed',String(savedOnly));
 $('places').replaceChildren();markers.clearLayers();
 if(!shown.length){const e=document.createElement('p');e.className='empty';e.textContent=savedOnly?'No saved places in this category yet.':'No places found. Try a larger radius or another category.';$('places').append(e)}
 for(const p of shown){
  const card=document.createElement('article');card.className='place';
  const title=document.createElement('h3');title.textContent=p.name;card.append(title);
  const info=document.createElement('p');info.textContent=categories[p.kind]+(p.km!=null?' · '+p.km.toFixed(1)+' km away':'');card.append(info);
  const actions=document.createElement('div');actions.className='place-actions';
  const save=document.createElement('button');save.textContent=stored[p.id]?'★ Saved':'☆ Save';save.setAttribute('aria-label',(stored[p.id]?'Remove saved ':'Save ')+p.name);
  save.onclick=()=>{if(stored[p.id])delete stored[p.id];else stored[p.id]=p;persist();render()};
  const view=document.createElement('button');view.textContent='Show on map';view.onclick=()=>{map.setView([p.lat,p.lon],14);window.scrollTo({top:$('map').getBoundingClientRect().top+window.scrollY-10,behavior:'smooth'})};
  const link=document.createElement('a');link.href='https://www.openstreetmap.org/'+p.type+'/'+p.osmId;link.target='_blank';link.rel='noopener';link.textContent='OSM details';
  actions.append(save,view,link);card.append(actions);$('places').append(card);
  L.marker([p.lat,p.lon]).bindPopup('<strong>'+escapeText(p.name)+'</strong><br>'+categories[p.kind]).addTo(markers);
 }
}
async function findPlaces(){
 if(!center){setStatus('Choose a city or use Near me first.');return}
 const id=++requestId,radius=Number($('radius').value),{lat,lon}=center;
 setStatus('Finding outdoor places in OpenStreetMap…');$('refresh').disabled=true;
 const query='[out:json][timeout:25];(nwr(around:'+radius+','+lat+','+lon+')['+'"boundary"="protected_area"'+'];nwr(around:'+radius+','+lat+','+lon+')['+'"leisure"="nature_reserve"'+'];nwr(around:'+radius+','+lat+','+lon+')['+'"tourism"="viewpoint"'+'];nwr(around:'+radius+','+lat+','+lon+')['+'"leisure"="bathing_place"'+'];nwr(around:'+radius+','+lat+','+lon+')['+'"natural"="beach"'+'];);out center 150;';
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  let response;try{response=await fetch('https://overpass.kumi.systems/api/interpreter',{method:'POST',body:new URLSearchParams({data:query}),signal:controller.signal})}finally{clearTimeout(timer)}
  if(!response.ok)throw Error('Map data service returned '+response.status);
  const data=await response.json();if(id!==requestId)return;
  const seen=new Set();
  places=(data.elements||[]).map(e=>{const pt=e.lat!=null?e:e.center;if(!pt||!Number.isFinite(pt.lat)||!Number.isFinite(pt.lon))return null;const name=e.tags?.name||e.tags?.['name:sv'];if(!name)return null;const key=e.type+'/'+e.id;if(seen.has(key))return null;seen.add(key);return {id:key,type:e.type,osmId:e.id,name,kind:classify(e.tags||{}),lat:pt.lat,lon:pt.lon,km:distance(center,pt)}}).filter(Boolean).sort((a,b)=>a.km-b.km);
  savedOnly=false;render();setStatus('Showing '+places.length+' named places. Distances are approximate straight-line distances. OSM coverage varies.');
 }catch(e){if(id===requestId)setStatus('Could not load places ('+e.message+'). The public data service may be busy. Please try again.')}finally{if(id===requestId)$('refresh').disabled=false}
}
async function searchCity(){
 const city=$('place').value.trim();if(!city)return;
 setStatus('Looking up '+city+'…');
 try{const res=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=se&q='+encodeURIComponent(city),{headers:{Accept:'application/json'}});if(!res.ok)throw Error('Location lookup unavailable');const items=await res.json();if(!items.length)throw Error('No matching Swedish location found');const x=items[0];center={lat:Number(x.lat),lon:Number(x.lon)};map.setView([center.lat,center.lon],11);await findPlaces()}catch(e){setStatus(e.message)}
}
$('search').onclick=searchCity;$('place').addEventListener('keydown',e=>{if(e.key==='Enter')searchCity()});
$('refresh').onclick=findPlaces;$('kind').onchange=render;
$('saved-toggle').onclick=()=>{savedOnly=!savedOnly;render()};
$('locate').onclick=()=>{if(!navigator.geolocation){setStatus('Geolocation is not supported by this browser.');return}setStatus('Requesting your location…');navigator.geolocation.getCurrentPosition(pos=>{center={lat:pos.coords.latitude,lon:pos.coords.longitude};map.setView([center.lat,center.lon],12);L.circleMarker([center.lat,center.lon],{radius:7,color:'#1e6eab'}).addTo(map).bindPopup('Your approximate location');findPlaces()},err=>setStatus('Location unavailable ('+err.message+'). Search for a city instead.'),{enableHighAccuracy:false,timeout:12000})};
render();