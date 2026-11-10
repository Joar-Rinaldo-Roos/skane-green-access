/* English, SGU-grounded explanations of mapped Swedish soil types.
 * Explanations describe the unit type, never invent local borehole measurements. */
(function(){
  'use strict';
  const SOURCE='https://www.sgu.se/globalassets/samhallsplanering/sgus-symbolsamling-for-jordarter.pdf';
  const HOW='https://www.sgu.se/geopraktisk/borrning/borrtekniker/vad-ar-borrning/inledning/att-borra-i-berg-och-jord/';
  const types=[
    {match:/moränfinlera|moranfinlera/,title:'Clay-rich glacial till',material:'A compact mixture of clay and other crushed rock particles, sometimes with sand, gravel and stones. SGU classifies this especially clay-rich till as containing over 25% clay.',formation:'During the last ice age, an enormous ice sheet ground up rock and deposited this unsorted mixture as the ice moved and melted.',meaning:'This is glacial material, not pure clay. The clay-rich matrix can retain water and behave differently from sandy ground.',questions:[['What is till?','Till is a mixed, unsorted sediment left directly by moving glacier ice. Unlike river sand, its particles were not neatly sorted by running water.'],['Why so much clay?','The ice could grind and mix fine material from softer sedimentary rocks and pre-existing clay-rich deposits. The local source rock controls the mixture.'],['Is this bedrock?','No. Till is a loose deposit on top of bedrock, which may be deeper and of a different rock type.']]},
    {match:/morängrovlera|morangrovlera/,title:'Clayey glacial till',material:'A dense mix of crushed rock particles and clay. SGU’s classification indicates approximately 15–25% clay.',formation:'Deposited and mixed by the ice sheet during the last glaciation.',meaning:'The clay makes this till finer and less permeable than coarse sand or gravel.',questions:[['What does “till” mean?','It is unsorted material left by a glacier, usually a mixture of different particle sizes.'],['Where are the stones from?','Glaciers can carry fragments from the rocks they travelled over, then leave them inside the sediment.']]},
    {match:/fyllning|utfyllnad/,title:'Artificial fill · ground shaped by people',material:'Material placed here by people, such as moved soil, sand, gravel, crushed rock or building-related debris. The map does not identify the specific mixture.',formation:'People raised, levelled or reclaimed land, or filled excavations. It may overlie older natural soil, and the date and purpose of placement vary.',meaning:'A clue that this patch of ground has a human history. Old maps and construction archives may reveal what was here before the fill.',questions:[['What might be below the fill?','An earlier soil surface, former wet ground, older deposits or bedrock. The mapping of artificial fill alone does not reveal the buried layer.'],['Why would someone add soil here?','Common reasons include making land level, preparing foundations, constructing roads or extending usable land. Which one applies here requires historical evidence.'],['Could the fill contain old objects?','Sometimes fill contains traces of earlier building work or waste, but this classification alone cannot establish age or contents.']]},
    {match:/moränlera|moranlera|lermorän|lermoran/,title:'Clay till',material:'Mixed glacial sediment with more than about 15% clay. The rest can include silt, sand, gravel and stones.',formation:'Ground rock and older sediments were pushed, mixed and left by glacier ice.',meaning:'The unsorted mixture reflects the rock and sediment the ice moved across.',questions:[['How is this different from river clay?','A river or lake can sort particles into layers. Till is deposited directly by ice and often mixes stones with fine material.'],['Why is till important?','It records how ice reshaped the landscape, and its texture affects drainage and soil conditions.']]},
    {match:/sandig.*morän|sandig.*moran|morän.*sand|moran.*sand/,title:'Sandy glacial till',material:'Mostly sand-sized particles mixed with finer material and often stones or gravel.',formation:'The ice sheet ground up rock and left behind an unsorted, sand-dominated deposit.',meaning:'It can drain more easily than very clay-rich till, but the exact composition varies.',questions:[['Why are there stones mixed with sand?','A glacier deposits a jumble of particle sizes instead of neatly sorting them the way water often does.'],['How old is it?','Most Swedish surface till is associated with the latest ice age, although particular deposits have their own histories.']]},
    {match:/morän|moran/,title:'Glacial till',material:'A natural mix of crushed rock particles, often containing clay, silt, sand, gravel and stones together.',formation:'Glacier ice scraped, transported and deposited this material, reshaping the ground during the ice age.',meaning:'This is the most widespread near-surface geological material across Sweden.',questions:[['What carried it here?','Moving ice and melt-related processes during the ice age.'],['Does it show the rock below?','Not necessarily. Ice can transport particles away from where they formed.']]},
    {match:/postglacial.*lera|postglacial.*finlera/,title:'Postglacial clay',material:'Fine clay particles settled out in relatively still water.',formation:'Deposited after glacier ice withdrew, when this land was covered by sea, lake or another water body.',meaning:'A reminder that the landscape’s shoreline and water levels have changed through time.',questions:[['Why would there be clay inland?','Some places now on dry land were underwater after the ice melted.'],['Why is it so fine?','Fine particles can remain suspended in water and settle slowly in quieter conditions.']]},
    {match:/glacial.*lera|glacial.*finlera|glacial.*grovlera/,title:'Glacial clay',material:'Very fine clay and silt laid down in water influenced by the melting ice sheet.',formation:'Meltwater carried tiny ground-rock particles into lakes or the sea, where they slowly settled.',meaning:'Some glacial clays preserve seasonal layers, like a record of meltwater changes.',questions:[['Can clay record seasons?','In some deposits, seasonal changes produce visible bands of different grain sizes called varves.'],['How does it differ from till?','Clay deposited in water is usually more sorted; till was placed directly by ice.']]},
    {match:/isälvssediment|isalvssediment|rullstensgrus/,title:'Glacial meltwater sediment',material:'Sorted sand, gravel and sometimes cobbles transported by streams of meltwater.',formation:'Fast-flowing water from the melting ice sheet carried and deposited different grain sizes.',meaning:'Evidence of former powerful meltwater rivers; some such deposits form eskers or broad sand/gravel fields.',questions:[['What is an esker?','A long ridge of sand and gravel deposited by a river that flowed within or beneath ice.'],['Why is the sediment sorted?','Moving water can separate coarse gravel from finer sand according to flow energy.']]},
    {match:/finsand|flygsand|sand/,title:'Sand deposit',material:'Loose mineral grains mostly in the sand size range. Some are from meltwater, streams, waves or wind, depending on the mapped subtype.',formation:'Rock was broken down and sand-sized grains were deposited by moving water, wind or ice-related processes.',meaning:'Sand generally allows water to pass more easily than clay.',questions:[['Where did the grains come from?','Erosion broke down rocks into smaller grains; water, ice and wind could move them.'],['Was this once a beach?','It depends on the mapped subtype and local setting. A label of “sand” alone is not proof of a former shoreline.']]},
    {match:/gyttja|dyjord/,title:'Organic-rich lake or wetland sediment',material:'Fine sediment mixed with decomposed organic material from water environments.',formation:'Accumulated in wet, often low-oxygen conditions such as lakes or shallow waters.',meaning:'It suggests this area may have a history of lakes or wetlands.',questions:[['Why does organic matter survive?','Waterlogged, low-oxygen conditions can slow decomposition.'],['What could be beneath it?','Older lake sediment, other soils or bedrock; the surface map does not define the full sequence.']]},
    {match:/torv|mosse|kärr/,title:'Peat · accumulated plant remains',material:'Partly decomposed plant matter, often containing mosses and other wetland vegetation.',formation:'Plant remains built up in persistently wet, oxygen-poor conditions over long periods.',meaning:'Peat stores evidence of past wetland environments and can retain carbon.',questions:[['How old can peat be?','Many peatlands developed after the last ice age, although age varies from place to place.'],['Why does it build up?','Waterlogged conditions slow decay, allowing dead plant matter to accumulate.']]},
    {match:/berg|urberg|kalksten|gnejs|granit/,title:'Bedrock at or near the surface',material:'The map indicates exposed or shallow solid rock rather than a thick mapped layer of loose soil. The soil-layer label alone does not identify a precise rock species.',formation:'Solid bedrock forms through geological processes such as the cooling of magma, accumulation of sediments or heat and pressure deep in the Earth.',meaning:'For the actual rock type, mineral content and geological age, the SGU bedrock map is the right next dataset.',questions:[['What is bedrock?','The consolidated rock underneath loose sediments, soils and built surfaces.'],['Is the rock granite, gneiss or limestone?','That cannot be determined from a generic “bedrock” symbol on the soil map. A dedicated bedrock unit or observation is needed.'],['What is above it?','There may be thin or discontinuous soil cover even where bedrock is mapped close to the surface.']]},
    {match:/lera|silt/,title:'Clay and silt deposit',material:'Fine mineral particles, much smaller than sand grains, forming a cohesive or silty sediment.',formation:'Such fine particles commonly settle in relatively calm water, though the precise story depends on the SGU subtype.',meaning:'Fine-grained ground often holds water longer than coarse gravel or sand.',questions:[['Why can clay feel sticky?','Clay particles are extremely small and interact with water, producing cohesive behaviour.'],['How do we know when it formed?','Specific layering, fossils and regional geology can provide clues; this map label alone cannot date it.']]}
  ];
  const fallback={title:'Mapped soil or surface geology',material:'SGU identifies this area with the Swedish map classification shown below. A more specific English definition has not yet been added to Here & Now.',formation:'Different soil units formed through ice, water, wind, biological processes or human land use.',meaning:'This is a mapped geological category. Follow the SGU source for the full legend.',questions:[['How can I learn more?','Open SGU’s geological map and compare this surface classification with deeper geological and bedrock data.']]};
  function explain(label) {
    const raw=String(label||'Unclassified');
    const type=types.find(t=>t.match.test(raw.toLocaleLowerCase('sv-SE'))) || fallback;
    return { ...type, original:raw, source:SOURCE, additionalSource:HOW };
  }
  function element(tag,cls,text) {
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=text;
    return node;
  }
  function createCard(rawLabel) {
    const e=explain(rawLabel);
    const card=element('div','soil-info-card');
    card.appendChild(element('strong','soil-english-title',e.title));
    card.appendChild(element('div','soil-swedish','SGU label: '+e.original));
    card.appendChild(element('p','',e.material));
    card.appendChild(element('h4','','How did it get here?'));
    card.appendChild(element('p','',e.formation));
    card.appendChild(element('h4','','Why it matters'));
    card.appendChild(element('p','',e.meaning));
    const head=element('h4','','Go deeper');
    card.appendChild(head);
    for(const [question,answer] of e.questions) {
      const details=element('details','soil-question');
      details.appendChild(element('summary','',question));
      details.appendChild(element('p','',answer));
      card.appendChild(details);
    }
    const a=element('a','soil-source','Source: SGU’s soil map legend ↗');
    a.href=e.source;a.target='_blank';a.rel='noopener noreferrer';
    card.appendChild(a);
    return card;
  }
  function createSummary(rawLabel) {
    const info=explain(rawLabel);
    const card=element('div','soil-info-card soil-summary');
    card.appendChild(element('strong','soil-english-title',info.title));
    card.appendChild(element('div','soil-swedish','SGU: '+info.original));
    card.appendChild(element('p','',info.material));
    const button=element('button','soil-read-more','Read more about this ground ↓');
    button.type='button';
    button.addEventListener('click',()=>openDetails(info.original));
    card.appendChild(button);
    return card;
  }
  function openDetails(rawLabel) {
    const info=explain(rawLabel);
    const panel=document.getElementById('geology-details');
    const inner=document.getElementById('geology-details-content');
    if(!panel||!inner)return false;
    inner.replaceChildren();
    inner.appendChild(element('h3','',info.title));
    inner.appendChild(element('p','soil-swedish','SGU label: '+info.original));
    const table=element('table','geology-details-table');
    const body=element('tbody','');
    for(const [heading,value] of [
      ['What it is made of',info.material],
      ['How did it get here?',info.formation],
      ['Why it matters',info.meaning]]) {
      const tr=element('tr','');
      const th=element('th','',heading);
      th.scope='row';
      tr.appendChild(th);
      tr.appendChild(element('td','',value));
      body.appendChild(tr);
    }
    table.appendChild(body);
    inner.appendChild(table);
    inner.appendChild(element('h4','geology-question-heading','Go deeper'));
    for(const [question,answer] of info.questions){
      const details=element('details','soil-question');
      details.appendChild(element('summary','',question));
      details.appendChild(element('p','',answer));
      inner.appendChild(details);
    }
    const link=element('a','soil-source','Read the SGU geological symbol guide ↗');
    link.href=info.source;
    link.target='_blank';
    link.rel='noopener noreferrer';
    inner.appendChild(link);
    panel.hidden=false;
    panel.scrollIntoView?.({behavior:'smooth',block:'start'});
    return true;
  }
  const close=document.getElementById('close-geology-details');
  if(close)close.addEventListener('click',()=>{
    const panel=document.getElementById('geology-details');
    if(panel)panel.hidden=true;
  });
  window.HereNowSoil={explain,createCard,createSummary,openDetails};
})();