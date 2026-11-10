import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  tokenMatches,cleanContext,buildOpenAIRequest,extractResponse,createHandler
} from './server.mjs';
const TOKEN='abcdef1234567890'.repeat(3);
const ORIGIN='https://joar-rinaldo-roos.github.io';
const LOCATION={latitude:55.71176,longitude:13.19868,locationKind:'GPS',
  accuracyMeters:12,soil:{swedishName:'Moränfinlera',englishName:'Clay-rich glacial till',material:'Glacial sediment'}};
const QUESTION='Why are there stones here?';
async function withServer(handler,fn){
  const server=http.createServer(handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address='http://127.0.0.1:'+server.address().port;
  try{await fn(address);}
  finally{await new Promise(resolve=>server.close(resolve));}
}
function post(body,token=TOKEN,origin=ORIGIN){
  return {method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify(body)};
}
function mockOpenAI(){
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push({url,init});
    return {ok:true,status:200,json:async()=>({
      output:[{type:'message',content:[{type:'output_text',
        text:'Those stones may be linked to the last ice age. What is inside the stones?',
        annotations:[{type:'url_citation',title:'SGU',url:'https://www.sgu.se/',start_index:0,end_index:5}]}]}]
    })};
  };
  return {calls,fetchImpl};
}
test('token comparison is constant-time for equal-length candidates',()=>{
  assert.equal(tokenMatches(TOKEN,TOKEN),true);
  assert.equal(tokenMatches(TOKEN,TOKEN+'x'),false);
  assert.equal(tokenMatches(TOKEN,'wrong'),false);
  assert.equal(tokenMatches('',TOKEN),false);
});
test('coordinates and source fields are bounded and validated',()=>{
  const context=cleanContext({...LOCATION,latitude:55.7117654321});
  assert.equal(context.latitude,55.71177);
  assert.equal(context.soil.englishName,'Clay-rich glacial till');
  assert.equal(cleanContext({latitude:123,longitude:12}),null);
  assert.equal(cleanContext({latitude:10,longitude:-190}),null);
});
test('OpenAI request contains location, uses store:false, and optional web search',()=>{
  const request=buildOpenAIRequest({
    context:cleanContext(LOCATION),question:QUESTION,model:'gpt-5.4-mini',webSearch:true
  });
  assert.equal(request.store,false);
  assert.equal(request.tools[0].type,'web_search');
  assert.match(request.input.at(-1).content,/Moränfinlera/);
  const noSearch=buildOpenAIRequest({context:cleanContext(LOCATION),question:QUESTION,webSearch:false});
  assert.equal(noSearch.tools,undefined);
});
test('health and allowed CORS preflight are available without the GPT key',async()=>{
  const handler=createHandler({accessToken:TOKEN,apiKey:'sk-fake'});
  await withServer(handler,async root=>{
    const h=await fetch(root+'/health',{headers:{Origin:ORIGIN}});
    assert.equal(h.status,200);
    assert.equal(h.headers.get('access-control-allow-origin'),ORIGIN);
    assert.equal((await h.json()).status,'ok');
    const o=await fetch(root+'/chat',{method:'OPTIONS',headers:{
      Origin:ORIGIN,'Access-Control-Request-Headers':'authorization, content-type',
      'Access-Control-Request-Method':'POST'
    }});
    assert.equal(o.status,204);
    assert.match(o.headers.get('access-control-allow-headers'),/Authorization/);
  });
});
test('GPT chat requires its own token and rejects unauthorized origins',async()=>{
  const {calls,fetchImpl}=mockOpenAI();
  await withServer(createHandler({accessToken:TOKEN,apiKey:'sk-fake',fetchImpl}),async root=>{
    const denied=await fetch(root+'/chat',post({question:QUESTION,context:LOCATION},'bad'));
    assert.equal(denied.status,401);
    const other=await fetch(root+'/chat',post({question:QUESTION,context:LOCATION},TOKEN,'https://evil.example'));
    assert.equal(other.status,403);
    assert.equal(calls.length,0);
  });
});
test('a real question reaches the mocked Responses API and returns cited answer',async()=>{
  const {calls,fetchImpl}=mockOpenAI();
  await withServer(createHandler({accessToken:TOKEN,apiKey:'sk-private-test',fetchImpl}),async root=>{
    const r=await fetch(root+'/chat',post({question:QUESTION,context:LOCATION}));
    assert.equal(r.status,200);
    const data=await r.json();
    assert.match(data.answer,/ice age/);
    assert.equal(data.citations[0].url,'https://www.sgu.se/');
    assert.equal(calls.length,1);
    assert.equal(calls[0].url,'https://api.openai.com/v1/responses');
    assert.equal(calls[0].init.headers.Authorization,'Bearer sk-private-test');
    assert.equal(JSON.parse(calls[0].init.body).store,false);
  });
});
test('invalid locations are rejected without calling the OpenAI API',async()=>{
  const {calls,fetchImpl}=mockOpenAI();
  await withServer(createHandler({accessToken:TOKEN,apiKey:'sk-fake',fetchImpl}),async root=>{
    const r=await fetch(root+'/chat',post({question:QUESTION,context:{latitude:99,longitude:14}}));
    assert.equal(r.status,400);
    assert.equal(calls.length,0);
  });
});
test('global request counter limits abuse',async()=>{
  const {fetchImpl}=mockOpenAI();
  await withServer(createHandler({accessToken:TOKEN,apiKey:'sk-fake',fetchImpl,maxHourly:1}),async root=>{
    const first=await fetch(root+'/chat',post({question:QUESTION,context:LOCATION}));
    const second=await fetch(root+'/chat',post({question:QUESTION,context:LOCATION}));
    assert.equal(first.status,200);
    assert.equal(second.status,429);
  });
});
