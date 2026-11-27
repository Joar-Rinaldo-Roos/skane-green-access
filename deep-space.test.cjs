'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {mount,URL}=require('./deep-space.js');
function harness(){
 const nodes=new Map(),scripts=[],calls=[];
 const doc={getElementById(id){if(!nodes.has(id))nodes.set(id,{hidden:id==='sky-view',attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(_,fn){this.click=fn;}});return nodes.get(id);},
   createElement(){return {remove(){this.removed=true;}};},head:{appendChild(s){scripts.push(s);}}};
 const win={setTimeout(){return 1;},clearTimeout(){},HereNowDiagnostics:{log(){}}};
 const ui=mount(win,doc);
 function ready(){win.A={init:Promise.resolve(),aladin(selector,options){calls.push({selector,options});return {};}};}
 return {ui,doc,win,nodes,scripts,calls,ready};
}
test('does not load on Earth; loads once on opening Deep space',async()=>{
 const h=harness();assert.equal(h.scripts.length,0);h.ui.open();assert.equal(h.scripts.length,0);
 h.nodes.get('sky-view').hidden=false;
 const p=h.ui.open();assert.equal(h.scripts.length,1);assert.equal(h.scripts[0].src,URL);
 h.ready();h.scripts[0].onload();await p;
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].selector,'#deep-space-atlas');
 assert.equal(h.calls[0].options.survey,'P/DSS2/color');
 h.ui.select('my');assert(h.nodes.get('deep-space-panel').hidden);assert(!h.nodes.get('my-sky-panel').hidden);
 await h.ui.select('deep');assert.equal(h.calls.length,1);assert.equal(h.scripts.length,1);
});
test('leaving Sky during loading defers initialization until return',async()=>{
 const h=harness();h.nodes.get('sky-view').hidden=false;
 const p=h.ui.open();h.nodes.get('sky-view').hidden=true;h.ready();h.scripts[0].onload();await p;
 assert.equal(h.calls.length,0);h.nodes.get('sky-view').hidden=false;await h.ui.open();
 assert.equal(h.calls.length,1);assert.equal(h.scripts.length,1);
});
test('script failure offers a retry without breaking Earth',async()=>{
 const h=harness();h.nodes.get('sky-view').hidden=false;
 const p=h.ui.open();h.scripts[0].onerror();await p;
 assert.equal(h.nodes.get('deep-space-retry').hidden,false);
 const next=h.ui.open();assert.equal(h.scripts.length,2);
 h.ready();h.scripts[1].onload();await next;assert.equal(h.calls.length,1);
});
