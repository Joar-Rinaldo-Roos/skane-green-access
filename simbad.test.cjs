'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {queryURL,parse,lookup,mount,explain,parallaxDistance,publishedDistance,clusterLinks,constellation,previewFov,previewURL,mountPreview}=require('./simbad.js');
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
 const doc={getElementById(id){if(!nodes.has(id))nodes.set(id,{classList:{toggle(){}},addEventListener(){},setAttribute(){},removeAttribute(){},replaceChildren(){}});return nodes.get(id);},createElement(){return {removeAttribute(){},set src(v){this.onload?.();}};}};
 const host={clientWidth:400,addEventListener(){}};
 const win={setTimeout,clearTimeout,fetch:async()=>({ok:true,json:async()=>({data:[['M 31',10,41,100,'G',4.3]]})})};
 const ui=mount(win,doc,{pix2world:()=>[10,41],getFov:()=>[1,1]},host);
 await ui.identify(10,20);
 assert.equal(nodes.get('sky-object-title').textContent,'M 31');
 assert.match(nodes.get('sky-object-description').textContent,/Galaxy/);
 assert.match(nodes.get('sky-object-technical').textContent,/4.30/);
 assert.equal(new URL(nodes.get('sky-object-link').href).searchParams.get('Ident'),'M 31');
});

test('turns SIMBAD classifications into readable explanations without inventing facts',()=>{
 assert.match(explain({type:'LXB'}).label,/Low-mass X-ray binary/);
 assert.match(explain({type:'cC*'}).description,/pulsation periods/);
 assert.equal(explain({type:'Other',typeLabel:'Other official type'}).label,'Other official type');
 assert.equal(parallaxDistance({parallax:0,parallaxError:.1}),null);
 assert.equal(parallaxDistance({parallax:3,parallaxError:1}),null);
 assert.equal(parallaxDistance({parallax:3,parallaxError:null}),null);
 assert(Math.abs(parallaxDistance({parallax:3.4,parallaxError:.1}).ly-959)<2);
 assert.equal(publishedDistance([[8,'kpc','paper']]).ly,26092.48);
 assert.equal(publishedDistance([[8,'unknown','paper']]),null);
 assert.deepEqual(clusterLinks([['A','GlC',80,'Globular cluster'],['A','GlC',60,'Globular cluster'],['B','G',90,'Galaxy']]),['A (80% reported membership)']);
 assert.equal(constellation({Astronomy:{Constellation(ra,dec){assert.equal(ra,18);assert.equal(dec,-29);return {name:'Sagittarius'};}}},{ra:270,dec:-29}),'Sagittarius');
});
test('extended cone record retains optional science fields',()=>{
 const result=parse({data:[['V* X Sgr',266,-27,356,'cC*',5.34,3.4,.1,'F5','Classical Cepheid Variable',42,'paper']]});
 assert.equal(result.oid,42);assert.equal(result.parallax,3.4);assert.equal(result.typeLabel,'Classical Cepheid Variable');
 const query=new URL(queryURL('https://example.org/',266,-27,.1)).searchParams.get('QUERY');
 assert.match(query,/basic.plx_value/);assert.match(query,/otypedef.description/);
});

test('preview URL uses exact catalogue coordinates and DSS2 colour with bounded image size',()=>{
 const u=new URL(previewURL({id:'M 20',ra:270.675,dec:-22.97167,type:'OpC'},.01));
 assert.equal(u.searchParams.get('hips'),'CDS/P/DSS2/color');assert.equal(u.searchParams.get('ra'),'270.675');
 assert.equal(u.searchParams.get('dec'),'-22.97167');assert.equal(u.searchParams.get('width'),'320');
 assert.equal(u.searchParams.get('format'),'jpg');assert.equal(previewFov('OpC',.01),.6);
 assert.equal(previewFov('*',.01),.15);assert.equal(previewFov('*',10),1.2);
 assert.match(previewURL({ra:1,dec:2},.01,1),/alaskybis/);
 assert.throws(()=>previewURL({ra:1,dec:91},.01));
});
test('preview retries mirror, marks loaded image, ignores stale callbacks and degrades gracefully',()=>{
 const nodes=new Map(),images=[],timers=new Map();let seq=0;
 const doc={getElementById(id){if(!nodes.has(id))nodes.set(id,{removeAttribute(k){delete this[k];},replaceChildren(...c){this.children=c;}});return nodes.get(id);},
 createElement(){const img={removeAttribute(k){delete this[k];}};images.push(img);return img;}};
 const win={setTimeout(fn){timers.set(++seq,fn);return seq;},clearTimeout(id){timers.delete(id);}};
 const p=mountPreview(win,doc);
 p.show({id:'M 20',ra:270.675,dec:-22.97167,type:'OpC'},.01);
 assert.equal(images.length,1);const stale=images[0].onload;images[0].onerror();assert.equal(images.length,2);
 stale();assert.equal(nodes.get('sky-object-image-frame').hidden,true);
 images[1].onload();assert.equal(nodes.get('sky-object-image-frame').hidden,false);
 assert.match(nodes.get('sky-object-image-source').href,/alaskybis/);
 p.show({id:'X Sgr',ra:266.89,dec:-27.83,type:'cC*'},.01);
 assert.equal(nodes.get('sky-object-image-frame').hidden,true);images[2].onerror();images[3].onerror();
 assert.match(nodes.get('sky-object-image-status').textContent,/temporarily unavailable/);
 p.clear();assert.equal(nodes.get('sky-object-preview').hidden,true);assert.equal(timers.size,0);
});
