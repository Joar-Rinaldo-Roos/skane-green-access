/* Swedish archive discovery: Riksantikvarieämbetet K-samsök.
 * Search a deliberately small radius and never invent an exact historical match. */
(function () {
  'use strict';
  const ENDPOINT='https://kulturarvsdata.se/ksamsok/api';
  const SOURCE='https://www.raa.se/museer/digital-omstallning-pa-museiomradet/k-samsok-en-digital-dataformedlingstjanst-for-kulturarv/att-anvanda-data-fran-k-samsok/';
  function log(msg){window.HereNowDiagnostics?.log('Swedish archives',msg);}
  function validUrl(raw){
    try {
      const url=new URL(String(raw));
      return (url.protocol==='https:' || url.protocol==='http:') ? url.href.replace(/^http:/,'https:') : '';
    }catch(_){return '';}
  }
  function flatten(value){
    if(value===undefined||value===null)return '';
    if(Array.isArray(value))return flatten(value[0]);
    if(typeof value==='object')return flatten(value['#text']??value.value??value._text??value.text??value._??value['$t']??'');
    return String(value);
  }
  function normalize(row) {
    const unwrap=row?.fields || row?.record || row?.data || row || {};
    const name=flatten(unwrap.itemLabel||unwrap.title||unwrap.label).trim();
    const id=flatten(unwrap.itemId||unwrap.id);
    const lat=Number(flatten(unwrap.lat||unwrap.latitude));
    const lon=Number(flatten(unwrap.lon||unwrap.longitude));
    const description=flatten(unwrap.itemDescription||unwrap.description).replace(/\s+/g,' ').trim();
    const photo=validUrl(flatten(unwrap.thumbnail||unwrap.thumbnailUrl||unwrap.image));
    const url=validUrl(flatten(unwrap.url||unwrap.entityUri||unwrap.itemUrl)) ||
      (id ? validUrl('https://kulturarvsdata.se/'+id.replace(/^https?:\/\/(?:www\.)?kulturarvsdata\.se\//,'')) : '');
    return {name,id,lat,lon,description,photo,url,type:flatten(unwrap.itemType||unwrap.type),
      owner:flatten(unwrap.serviceOrganization||unwrap.organization),source:SOURCE};
  }
  function parseJson(json) {
    let records=json?.result?.records?.record || json?.records?.record ||
      json?.result?.records || json?.records || json?.result?.record ||
      json?.items || json?.result?.items || [];
    if(records.record)records=records.record;
    if(!Array.isArray(records)) records=[records];
    return records.filter(Boolean).map(normalize);
  }
  function parseXml(text) {
    const doc=new DOMParser().parseFromString(text,'application/xml');
    if(doc.querySelector('parsererror'))throw Error('Invalid archive XML');
    const nodes=Array.from(doc.getElementsByTagName('record'));
    return nodes.map(node=>{
      const obj={};
      for(const el of Array.from(node.children)){
        const key=el.localName;
        if(key) obj[key]=el.textContent;
      }
      return normalize(obj);
    });
  }
  function radians(n){return n*Math.PI/180;}
  function meters(a,b) {
    const lat=radians(b.lat-a.lat),lon=radians(b.lon-a.lon);
    const k=Math.sin(lat/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(lon/2)**2;
    return 12742000*Math.atan2(Math.sqrt(k),Math.sqrt(1-k));
  }
  function buildUrl(point,radiusMeters) {
    // Explicit WGS84 bbox order: west south east north, per RAÄ documentation.
    const dLat=radiusMeters/111320;
    const dLon=radiusMeters/(111320*Math.max(0.2,Math.cos(radians(point.lat))));
    const west=(point.lon-dLon).toFixed(6), south=(point.lat-dLat).toFixed(6),
      east=(point.lon+dLon).toFixed(6), north=(point.lat+dLat).toFixed(6);
    const query='boundingBox=/WGS84 "'+[west,south,east,north].join(' ')+'"';
    const params=new URLSearchParams({method:'search',version:'1.1',hitsPerPage:'100',
      recordSchema:'xml',
      fields:'itemId,itemLabel,itemDescription,thumbnail,url,lon,lat,itemType,serviceOrganization',
      query});
    return ENDPOINT+'?'+params;
  }
  async function search(point, radiusMeters=75) {
    const radius=Math.max(20,Math.min(300,Number(radiusMeters)||75));
    if(!Number.isFinite(point?.lat)||!Number.isFinite(point?.lon))throw Error('Select a location first');
    const url=buildUrl(point,radius);
    log('Searching Swedish archive catalogue within '+radius+' m (coordinates omitted)');
    const abort=new AbortController();
    const timer=setTimeout(()=>abort.abort(),14000);
    try {
      const response=await fetch(url,{headers:{'Accept':'application/json'},signal:abort.signal});
      log('K-samsök HTTP '+response.status);
      if(!response.ok)throw Error('K-samsök returned HTTP '+response.status);
      const body=await response.text();
      const looksJson=body.trimStart().startsWith('{')||body.trimStart().startsWith('[');
      const records=looksJson?parseJson(JSON.parse(body)):parseXml(body);
      log('K-samsök returned '+records.length+' catalogue records');
      const valid=records.filter(item=>item.name&&item.url&&Number.isFinite(item.lat)&&Number.isFinite(item.lon))
        .map(item=>({...item,distanceMeters:meters(point,item)}))
        .filter(item=>item.distanceMeters<=radius+2);
      // The source coordinates are catalogued object locations, which may represent a building or scene, not camera placement.
      valid.sort((a,b)=>{
        const rank=item=>Math.min(1000,item.distanceMeters) + (item.photo?-18:0) - Math.min(item.description.length,200)/20;
        return rank(a)-rank(b);
      });
      log(valid.length+' geolocated records inside '+radius+' m after distance filtering');
      return valid.slice(0,25);
    } catch(error){
      const message=error.name==='AbortError'?'archive request timed out':error.message;
      log('Archive request failed: '+message);
      throw Error('Swedish archives could not be reached: '+message);
    }finally{clearTimeout(timer);}
  }
  window.HereNowArchives={search,buildUrl,parseJson,normalize,source:SOURCE};
})();