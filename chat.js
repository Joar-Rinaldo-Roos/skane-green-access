/* Ask Here & Now — browser-side UI for a PERSONAL Mac-hosted backend.
 * OpenAI API key never touches the browser; only a separate access token does. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const form=$('ask-form'),question=$('ask-question'),historyEl=$('ask-messages');
  const status=$('ask-status'),urlField=$('backend-url'),tokenField=$('backend-token');
  if(!form||!question||!historyEl||!status)return;
  const storage={get(name,store){try{return store.getItem(name)||'';}catch(_){return '';}},
    set(name,value,store){try{store.setItem(name,value);}catch(_){}}};
  let backendUrl=storage.get('here-now-backend-url',localStorage);
  let accessToken=storage.get('here-now-backend-token',sessionStorage);
  let turns=[],busy=false;
  if(urlField)urlField.value=backendUrl;
  if(tokenField)tokenField.value=accessToken;
  function log(message){window.HereNowDiagnostics?.log('GPT Chat',message);}
  function setStatus(message){status.textContent=message;}
  function normalizedUrl(raw){
    const url=new URL(String(raw||'').trim());
    const local=url.hostname==='localhost'||url.hostname==='127.0.0.1';
    if(url.protocol!=='https:'&&!(local&&url.protocol==='http:'))throw Error('Use your HTTPS tunnel URL (https://…trycloudflare.com).');
    if(url.username||url.password||url.search||url.hash)throw Error('Paste only the backend base URL, without a path, query or password.');
    return url.origin;
  }
  async function connect(){
    const link=normalizedUrl(urlField.value);
    const token=tokenField.value.trim();
    if(token.length<32)throw Error('Enter the separate access token from your Mac .env (32+ characters).');
    setStatus('Checking the connection to your Mac…');
    const control=new AbortController(),timer=setTimeout(()=>control.abort(),14000);
    try{
      const res=await fetch(link+'/health',{signal:control.signal,cache:'no-store'});
      if(!res.ok)throw Error('Backend health check HTTP '+res.status);
      const data=await res.json();
      if(data.status!=='ok')throw Error('This address does not respond as a Here & Now backend.');
      backendUrl=link;accessToken=token;
      storage.set('here-now-backend-url',backendUrl,localStorage);
      storage.set('here-now-backend-token',accessToken,sessionStorage);
      setStatus('Connected to your Mac backend. Try asking about this place.');
      $('chat-settings').open=false;
      log('Backend health check successful (no secrets logged)');
    }finally{clearTimeout(timer);}
  }
  $('backend-connect')?.addEventListener('click',()=>connect().catch(error=>{
    setStatus('Connection failed: '+(error.name==='AbortError'?'timed out':error.message));
    log('Connection failed: '+(error.name==='AbortError'?'timed out':error.message));
  }));
  $('backend-disconnect')?.addEventListener('click',()=>{
    backendUrl='';accessToken='';tokenField.value='';
    storage.set('here-now-backend-url','',localStorage);
    storage.set('here-now-backend-token','',sessionStorage);
    setStatus('Disconnected. Your map and other discoveries still work.');
  });
  function bubble(kind,text){
    const div=document.createElement('article');
    div.className='chat-bubble chat-'+kind;
    const heading=document.createElement('strong');
    heading.textContent=kind==='user'?'You':'✦ Here & Now';
    div.appendChild(heading);
    const body=document.createElement('div');
    body.className='chat-body';
    body.textContent=text;
    div.appendChild(body);
    historyEl.appendChild(div);
    historyEl.scrollTop=historyEl.scrollHeight;
    return {div,body};
  }
  function appendSources(parent,citations){
    if(!Array.isArray(citations)||!citations.length)return;
    const section=document.createElement('div');
    section.className='chat-sources';
    const label=document.createElement('strong');
    label.textContent='Sources to explore';
    section.appendChild(label);
    for(const item of citations.slice(0,8)){
      try{
        const u=new URL(item.url);
        if(!['http:','https:'].includes(u.protocol))continue;
        const a=document.createElement('a');
        a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';
        a.textContent=String(item.title||u.hostname).slice(0,120)+' ↗';
        section.appendChild(a);
      }catch(_){}
    }
    parent.appendChild(section);
  }
  function selectedContext(){
    const app=window.HereNowAppContext?.();
    if(app&&Number.isFinite(app.lat)&&Number.isFinite(app.lon))return app;
    const view=window.HereNowMap?.getView?.();
    if(!view||!Number.isFinite(view.lat)||!Number.isFinite(view.lon))return null;
    return {lat:view.lat,lon:view.lon,name:'visible map center (not GPS)',kind:'map center'};
  }
  async function collectContext(){
    const place=selectedContext();
    if(!place)throw Error('Choose a place or tap Find me before asking.');
    const context={
      latitude:place.lat,longitude:place.lon,label:place.name||'selected map point',
      locationKind:place.kind||'map center',
      accuracyMeters:place.accuracy||null,soil:null,history:[]
    };
    const near=window.HereNowLocalHistory?.discover?.(place)||[];
    context.history=near.slice(0,3).map(item=>({title:item.title,summary:item.text,source:item.url}));
    try{
      const mapped=window.HereNowMap?.getSoilAt?.(place)
        || await window.HereNowMap?.lookupSoilAt?.(place);
      if(mapped){
        const name=mapped.properties?.jg2_tx||mapped.properties?.jg2||'';
        const info=window.HereNowSoil?.explain?.(name);
        context.soil={swedishName:name,englishName:info?.title||'',material:info?.material||'',formation:info?.formation||''};
      }
    }catch(error){log('SGU data unavailable for question: '+error.message);}
    return context;
  }
  async function ask(text){
    if(busy)return;
    const userText=String(text||'').trim();
    if(!userText)return;
    if(!backendUrl||!accessToken){
      $('chat-settings').open=true;
      setStatus('First connect your Mac backend: enter the tunnel URL and your private access token.');
      return;
    }
    busy=true;
    $('ask-send').disabled=true;
    question.disabled=true;
    question.value='';
    const prior=turns.slice(-6);
    bubble('user',userText);
    const loading=bubble('assistant','Investigating this location…');
    setStatus('Finding what is interesting about this place…');
    const control=new AbortController(),timer=setTimeout(()=>control.abort(),85000);
    try{
      const context=await collectContext();
      // Coordinates are sent only when you deliberately ask a question.
      const res=await fetch(backendUrl+'/chat',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+accessToken},
        body:JSON.stringify({question:userText,context,history:prior}),signal:control.signal
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(data.error||'Backend HTTP '+res.status);
      if(!data.answer)throw Error('The backend returned no answer.');
      loading.body.textContent=data.answer;
      appendSources(loading.div,data.citations);
      turns.push({role:'user',text:userText},{role:'assistant',text:data.answer});
      if(turns.length>14)turns=turns.slice(-14);
      setStatus('Ask a follow-up. Your recent conversation stays in this browser tab.');
      log('Answer received; '+(data.citations?.length||0)+' source links');
    }catch(error){
      loading.body.textContent='Could not answer: '+(error.name==='AbortError'?'request timed out':error.message);
      setStatus('Check your Mac backend, tunnel URL and access token. Other map features are unaffected.');
      log('Chat request failed: '+(error.name==='AbortError'?'timeout':error.message));
    }finally{
      clearTimeout(timer);busy=false;$('ask-send').disabled=false;question.disabled=false;
      historyEl.scrollTop=historyEl.scrollHeight;
    }
  }
  form.addEventListener('submit',event=>{event.preventDefault();ask(question.value);});
  for(const suggestion of document.querySelectorAll('[data-ask-prompt]')){
    suggestion.addEventListener('click',()=>{question.value=suggestion.dataset.askPrompt||'';question.focus();});
  }
  if(backendUrl&&accessToken)setStatus('Mac settings restored for this tab. Ask a question to reconnect.');
  window.HereNowChat={ask,normalizedUrl};
})();