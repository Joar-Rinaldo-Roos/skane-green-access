/* Shared, deterministic green-space data functions for browser and Node tests.
 * OSM polygons describe mapped green spaces, NOT guaranteed public walking access. */
(function(root){
  'use strict';
  function validPoint(point){
    return point && Number.isFinite(point.lat) && Number.isFinite(point.lon) &&
      Math.abs(point.lat)<=90 && Math.abs(point.lon)<=180;
  }
  function buildOverpassQuery(point,radius=1200){
    if(!validPoint(point))throw Error('Invalid coordinates');
    if(!Number.isInteger(radius)||radius<200||radius>2000)throw Error('Invalid search radius');
    const circle='(around:'+radius+','+point.lat.toFixed(5)+','+point.lon.toFixed(5)+')';
    return '[out:json][timeout:20][maxsize:10000000];('+
      'way["leisure"~"^(park|garden|nature_reserve)$"]'+circle+';'+
      'way["landuse"~"^(forest|grass|recreation_ground)$"]'+circle+';'+
      'way["natural"="wood"]'+circle+';'+
      'relation["leisure"~"^(park|garden|nature_reserve)$"]'+circle+';'+
      'relation["landuse"~"^(forest|grass|recreation_ground)$"]'+circle+';'+
      'relation["natural"="wood"]'+circle+';'+
      ');out geom;';
  }
  function kindFromTags(tags={}){
    if(tags.leisure==='park')return 'Park';
    if(tags.leisure==='garden')return 'Garden';
    if(tags.leisure==='nature_reserve')return 'Nature reserve';
    if(tags.landuse==='forest'||tags.natural==='wood')return 'Forest';
    if(tags.landuse==='grass'||tags.landuse==='recreation_ground')return 'Green area';
    return null;
  }
  function ring(points){
    if(!Array.isArray(points)||points.length<4)return null;
    const coords=points.map(p=>[Number(p?.lon),Number(p?.lat)]);
    if(coords.some(([lon,lat])=>!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>90))return null;
    const a=coords[0],b=coords[coords.length-1];
    if(a[0]!==b[0]||a[1]!==b[1])return null; // Never close an unmapped open way.
    if(new Set(coords.map(p=>p.join(','))).size<3)return null;
    return coords;
  }
  function inside(point,outline){
    let yes=false;
    for(let i=0,j=outline.length-1;i<outline.length;j=i++){
      const a=outline[i],b=outline[j];
      if(((a[1]>point[1])!==(b[1]>point[1])) &&
        point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;
    }
    return yes;
  }
  function toGeoJSON(raw,maxFeatures=100){
    const rows=Array.isArray(raw?.elements)?raw.elements:[];
    const features=[],memberWays=new Set(),seen=new Set();
    // Relations first: prevents a constituent way from being drawn again as another park.
    for(const row of [...rows.filter(x=>x?.type==='relation'),...rows.filter(x=>x?.type==='way')]){
      if(features.length>=maxFeatures)break;
      const kind=kindFromTags(row.tags);
      if(!kind||!Number.isSafeInteger(row.id)||row.id<=0)continue;
      const id=row.type+'/'+row.id;
      if(seen.has(id)||(row.type==='way'&&memberWays.has(String(row.id))))continue;
      let geometry=null;
      if(row.type==='way'){
        const outline=ring(row.geometry);
        if(outline)geometry={type:'Polygon',coordinates:[outline]};
      }else if(row.type==='relation'){
        const members=Array.isArray(row.members)?row.members:[];
        const outer=members.filter(x=>x?.role==='outer').map(x=>ring(x.geometry)).filter(Boolean);
        if(!outer.length)continue;
        const holes=members.filter(x=>x?.role==='inner').map(x=>ring(x.geometry)).filter(Boolean);
        const polygons=outer.map(shape=>[shape,...holes.filter(hole=>inside(hole[0],shape))]);
        geometry={type:'MultiPolygon',coordinates:polygons};
        members.filter(m=>m?.type==='way'&&Number.isSafeInteger(m.ref)).forEach(m=>memberWays.add(String(m.ref)));
      }
      if(!geometry)continue;
      seen.add(id);
      features.push({
        type:'Feature',id,
        geometry,
        properties:{
          name:String(row.tags?.name||kind).slice(0,120),
          kind,
          osmId:id,
          url:'https://www.openstreetmap.org/'+id
        }
      });
    }
    return {type:'FeatureCollection',features};
  }
  function cacheKey(point){
    if(!validPoint(point))throw Error('Invalid coordinates');
    return point.lat.toFixed(2)+','+point.lon.toFixed(2);
  }
  const api={buildOverpassQuery,toGeoJSON,cacheKey,kindFromTags};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.HereNowGreenCore=api;
})(typeof window==='undefined'?null:window);
