/* Place-aware, source-backed stories when catalogue geotags fail to capture area history.
 * Curated entries are explicitly about a district, never exact GPS-coordinate claims. */
(function(){
  'use strict';
  const haversine=(a,b)=>{
    const rad=n=>n*Math.PI/180,dLat=rad(a.lat-b.lat),dLon=rad(a.lon-b.lon);
    const x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
    return 12742000*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
  };
  const sites=[
    {
      name:'Lund University Hospital district',
      point:{lat:55.71176,lon:13.19868},radius:850,
      cards:[
        {
          title:'From two beds to a university hospital',
          category:'History · Lund hospital district',
          text:'The Lund infirmary began receiving patients in 1768. It started with just two beds; its first recorded patient was Sune Pährsson from Barsebäck. Over the next centuries, medical training and new buildings transformed this small infirmary into a major university hospital.',
          url:'https://www.medicinhistoriskasyd.se/Bildspel/Lazarett/Lazarett%2001.01.html',
          image:null,
          meta:'Documented history of Lund’s hospital district, not necessarily this exact building',
          extraLinks:[
            {title:'Explore original photographs',url:'https://www.medicinhistoriskasyd.se/SMHS_bilder/thumbnails.php?album=30&page=4'},
            {title:'Read the historical overview',url:'https://www.medicinhistoriskasyd.se/Bildspel/Lazarett/Lazarett%2001.01.html'}
          ]
        },
        {
          title:'When the hospital moved north',
          category:'History · Lund hospital district',
          text:'Lund’s hospital gradually expanded north of Allhelgona Kyrkogata. Its large central block opened in 1968, bringing clinical departments into a new 12-storey building. The older southern hospital buildings were eventually repurposed for university activities.',
          url:'https://www.medicinhistoriskasyd.se/Bildspel/Lazarett/Lazarett%2001.01.html',
          meta:'The hospital campus has changed shape across generations',
          image:null,
          extraLinks:[{title:'See historical hospital images',url:'https://www.medicinhistoriskasyd.se/SMHS_bilder/thumbnails.php?album=30&page=4'}]
        },
        {
          title:'See what care looked like a century ago',
          category:'History · Lund hospital photographs',
          text:'Sydsvenska Medicinhistoriska Sällskapet preserves photographs of former departments, staff and buildings. One photograph documents Lund’s surgical outpatient clinic in 1905. Browse the collection to compare the past with the hospital district today.',
          url:'https://www.medicinhistoriskasyd.se/Bildspel/Bildarkiv%20SMHS/Bild100911-021.html',
          meta:'An archival photograph of a historical hospital room, not necessarily taken at your GPS location',
          image:null,
          extraLinks:[{title:'Open the 1905 photograph',url:'https://www.medicinhistoriskasyd.se/Bildspel/Bildarkiv%20SMHS/Bild100911-021.html'}]
        }
      ]
    }
  ];
  function discover(point){
    if(!Number.isFinite(point?.lat)||!Number.isFinite(point?.lon))return [];
    for(const site of sites){
      if(haversine(point,site.point)<=site.radius){
        window.HereNowDiagnostics?.log('History','Matched sourced '+site.name+' context (coordinates omitted)');
        return site.cards.map(c=>({...c}));
      }
    }
    return [];
  }
  window.HereNowLocalHistory={discover,haversine};
})();