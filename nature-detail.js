/* Nature: local iNaturalist records + independently sourced identification and diet.
 * Never infer which individual animal is standing at the user's GPS point. */
(function () {
  'use strict';
  const science = {
    'anas platyrhynchos': {
      appearance:'The male Mallard is the familiar duck with a shimmering green head, yellow bill and chestnut-brown breast. The female is mottled brown; both have a blue-violet patch on the wing.',
      diet:'Mallards dabble in shallow water and feed on aquatic plants, seeds, grasses, insects and other small aquatic invertebrates. Ducklings eat many tiny aquatic animals.',
      curiosity:'The loud, familiar duck “quack” is mostly the female’s call. Many Mallards thrive around city parks and ponds.',
      url:'https://www.audubon.org/field-guide/bird/mallard'
    }
  };
  const animalGroups=new Set(['Aves','Mammalia','Amphibia','Reptilia','Insecta','Arachnida','Mollusca','Actinopterygii','Animalia']);
  const allowedLicenses=new Set(['cc0','cc-by','cc-by-sa']);
  const safeHttps = raw => {
    try {const u=new URL(raw);return u.protocol==='https:'?u.href:'';}
    catch (_) {return '';}
  };
  function choosePhoto(photo){
    if (!photo || !allowedLicenses.has(String(photo.license_code||'').toLowerCase()))return null;
    const url=safeHttps(photo.medium_url||photo.url||'');
    if(!url)return null;
    return {url,credit:String(photo.attribution||'iNaturalist contributor'),license:String(photo.license_code||'').toUpperCase()};
  }
  function buildItems(rows,radius=5){
    const species=(rows||[]).filter(r=>r?.taxon?.id&&r.taxon.name&&
      (r.taxon.rank==='species'||r.taxon.rank==='subspecies')&&
      animalGroups.has(r.taxon.iconic_taxon_name));
    // Prefer locally frequently recorded species with licensed photographs.
    const ranked=species.map(r=>({r,photo:choosePhoto(r.taxon.default_photo)}))
      .sort((a,b)=>(Number(b.r.count||0)+Number(Boolean(b.photo))*6)-
                   (Number(a.r.count||0)+Number(Boolean(a.photo))*6))
      .slice(0,20);
    return ranked.map(({r,photo})=>{
      const taxon=r.taxon,common=taxon.preferred_common_name||taxon.name;
      const basic=science[taxon.name.toLowerCase()];
      return {
        title:common,
        text:basic?basic.appearance:'Searching natural-history sources for '+common+'…',
        category:'Nature · wildlife recorded locally',
        url:basic?.url||('https://www.inaturalist.org/taxa/'+taxon.id),
        sourceUrl:'https://www.inaturalist.org/taxa/'+taxon.id,
        image:photo?.url||null,
        imageCredit:photo?photo.credit+' · '+photo.license:null,
        imageAlt:'Identification photo of '+common,
        meta:'iNaturalist: '+Number(r.count||0)+' research-grade observations within '+radius+' km · '+taxon.name,
        nature:{taxonId:taxon.id,scientificName:taxon.name,commonName:common,photo,known:basic||null}
      };
    });
  }
  function trimText(value,limit=900){
    return String(value||'').replace(/\s+/g,' ').trim().slice(0,limit);
  }
  async function enrich(item){
    if(!item?.nature)return item;
    const info=item.nature,known=info.known;
    const details=[];
    if(known){
      details.push({label:'What it looks like',text:known.appearance});
      details.push({label:'What it eats',text:known.diet});
      details.push({label:'A surprising detail',text:known.curiosity});
      item.text=known.appearance;
      item.url=known.url;
    }
    // Use Wikipedia only for general species knowledge; location data stays with iNaturalist.
    const params=new URLSearchParams({
      action:'query',format:'json',origin:'*',redirects:'1',
      titles:info.scientificName,prop:'extracts|pageimages|info',inprop:'url',
      explaintext:'1',exintro:'1',exchars:'2000',pithumbsize:'600'
    });
    // Correct MediaWiki extract options. No scraped pages or untrusted HTML rendering.
    params.delete('explaintext'); // no-op in browsers that normalize duplicated params
    params.set('explaintext','1');
    try{
      const response=await fetch('https://en.wikipedia.org/w/api.php?'+params);
      window.HereNowDiagnostics?.log('Nature','Species background HTTP '+response.status);
      if(response.ok){
        const data=await response.json();
        const page=Object.values(data.query?.pages||{})[0];
        if(page && !page.missing){
          const extract=trimText(page.extract,1150);
          if(extract){
            if(!known){item.text=extract;details.push({label:'Meet this species',text:extract});}
            else details.push({label:'More natural history',text:extract});
          }
          if(!item.image && page.thumbnail?.source){
            // Wikipedia thumbnails may have distinct image licences. Keep the image on its linked source.
            item.photoLink=page.fullurl||'https://en.wikipedia.org/wiki/'+encodeURIComponent(info.scientificName.replace(/ /g,'_'));
          }
          item.moreSource=page.fullurl||null;
        }
      }
    }catch(error){
      window.HereNowDiagnostics?.log('Nature','Species background unavailable: '+error.message);
    }
    if(details.length===0)details.push({
      label:'Explore this species',text:'Open its iNaturalist profile for identification photographs, observations and community links.'
    });
    item.natureDetails=details;
    return item;
  }
  window.HereNowNature={buildItems,enrich,choosePhoto};
})();