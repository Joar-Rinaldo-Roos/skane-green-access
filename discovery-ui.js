/* Displays sourced wildlife facts, sky positions and historical archive links.
 * Extra material sits below the discovery headline, never over the map. */
(function(){
  'use strict';
  let current=null;
  const el=(tag,text,cls)=>{
    const node=document.createElement(tag);
    if(text!==undefined)node.textContent=text;
    if(cls)node.className=cls;
    return node;
  };
  function link(title,href){
    if(!/^https:\/\//.test(href||''))return null;
    const a=el('a',title+' ↗');
    a.href=href;a.target='_blank';a.rel='noopener noreferrer';
    return a;
  }
  function nature(root,p){
    const details=p.natureDetails || (p.nature.known ? [
      {label:'How to recognise it',text:p.nature.known.appearance},
      {label:'What does it eat?',text:p.nature.known.diet},
      {label:'Did you know?',text:p.nature.known.curiosity}
    ] : [{label:'Meet this species',text:'Looking up a natural-history field guide…'}]);
    for(const fact of details){
      const card=el('section',undefined,'nature-fact');
      card.appendChild(el('h3',fact.label));
      card.appendChild(el('p',fact.text));
      root.appendChild(card);
    }
    const source=link('See records and photographs on iNaturalist',p.sourceUrl);
    if(source)root.appendChild(source);
    const wiki=link('Read the species article on Wikipedia',p.moreSource);
    if(wiki){root.appendChild(el('p',''));root.appendChild(wiki);}
    if(!p.natureLoading&&!p.natureLoaded){
      p.natureLoading=true;
      window.HereNowNature?.enrich(p).then(()=>{
        p.natureLoaded=true;
        if(current===p){
          const factText=document.getElementById('fact-text');
          const sourceLink=document.getElementById('source');
          if(factText)factText.textContent=p.text;
          if(sourceLink)sourceLink.href=p.url;
          render(p);
        }
      }).catch(error=>{
        window.HereNowDiagnostics?.log('Nature','Field guide could not load: '+error.message);
      }).finally(()=>{p.natureLoading=false;});
    }
  }
  function sky(root,p){
    root.appendChild(el('h3','Where to look tonight'));
    const table=el('table',undefined,'sky-table');
    const head=el('thead');const tr=el('tr');
    for(const label of ['Object','Above the horizon?','Look toward'])tr.appendChild(el('th',label));
    head.appendChild(tr);table.appendChild(head);
    const body=el('tbody');
    for(const item of p.skyRows){
      const tr=el('tr',undefined,item.above?'':'sky-muted');
      tr.appendChild(el('td',item.body));
      tr.appendChild(el('td',item.above?Math.round(item.altitude)+'° high':'Very low / below'));
      tr.appendChild(el('td',item.direction));
      body.appendChild(tr);
      const detail=el('tr',undefined,'sky-description');
      const cell=el('td',item.description+(item.illuminated!=null?' Moon illuminated: '+item.illuminated+'%.':''));
      cell.colSpan=3;detail.appendChild(cell);body.appendChild(detail);
    }
    table.appendChild(body);root.appendChild(table);
    root.appendChild(el('p','Positions calculated for 21:00 in your phone’s local time zone, at the location you selected.','sky-time-note'));
    const source=link('How the planet positions are calculated',p.url);
    if(source)root.appendChild(source);
  }
  function sources(root,p){
    if(!p.extraLinks?.length)return;
    const box=el('div',undefined,'extra-links');
    box.appendChild(el('h3','Explore the original records'));
    for(const item of p.extraLinks){
      const a=link(item.title,item.url);
      if(a)box.appendChild(a);
    }
    root.appendChild(box);
  }
  function render(p){
    current=p;
    const root=document.getElementById('discovery-extras');
    if(!root)return;
    root.replaceChildren();
    root.hidden=!(p.nature||p.skyRows||p.extraLinks?.length);
    if(p.nature)nature(root,p);
    if(p.skyRows)sky(root,p);
    sources(root,p);
  }
  window.HereNowDiscoveryUI={render};
})();