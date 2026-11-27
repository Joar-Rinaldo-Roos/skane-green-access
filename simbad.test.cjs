'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {queryURL,parse,lookup,mount}=require('./simbad.js');
test('builds encoded, bounded ADQL query with no arbitrary input',()=>{
 const u=new URL(queryURL('https://example.org/',-10,-20,.01));
 assert.match(u.searchParams.get('QUERY'),/350, -20, 0.01/);
 assert.throws(()=>queryURL('https://example.org/',0,91,.01));
 assert.throws(()=>queryURL('https://example.org/',0,0,3));
});
test('parses catalogue records and distinguishes empty from malformed',()=>{
 assert.deepEqual(parse({data:[[' M 31 ',10,41,100,'G',4.3]]}),{id:'M 31',ra:10,dec:41,references:100,type:'G',magnitude:4.3});
 assert.equal(parse({data:[]}),null);assert.throws(()=>parse({error:'bad'}));
});
test('uses mirror fallback on failure, not on a valid empty result',async()=>{
 let calls=0;
 const win={setTimeout,clearTimeout,fetch:async()=>{calls++;return calls===1?{ok:false,status:503}:{ok:true,json:async()=>({data:[]})};}};
 const answer=await lookup(win,1,2,.01,new AbortController().signal);
 assert.equal(calls,2);assert.equal(answer.result,null);assert.match(answer.base,/idia/);
});
test('shows a result card and safe source link after identification',async()=>{
 const nodes=new Map();
 const doc={getElementById(id){if(!nodes.has(id))nodes.set(id,{classList:{toggle(){}},addEventListener(){},setAttribute(){},removeAttribute(){}});return nodes.get(id);}};
 const host={clientWidth:400,addEventListener(){}};
 const win={setTimeout,clearTimeout,fetch:async()=>({ok:true,json:async()=>({data:[['M 31',10,41,100,'G',4.3]]})})};
 const ui=mount(win,doc,{pix2world:()=>[10,41],getFov:()=>[1,1]},host);
 await ui.identify(10,20);
 assert.equal(nodes.get('sky-object-title').textContent,'M 31');
 assert.match(nodes.get('sky-object-description').textContent,/Galaxy/);
 assert.match(nodes.get('sky-object-facts').textContent,/4.30/);
 assert.equal(new URL(nodes.get('sky-object-link').href).searchParams.get('Ident'),'M 31');
});
