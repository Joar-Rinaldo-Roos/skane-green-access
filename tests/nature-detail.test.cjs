const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test');
const script=fs.readFileSync(path.join(__dirname,'..','nature-detail.js'),'utf8');
function boot(){
  const window={HereNowDiagnostics:{log(){}}};
  vm.runInNewContext(script,{window,URL,URLSearchParams,fetch:async()=>({ok:false,status:404})});
  return window.HereNowNature;
}
test('iNaturalist observations become photographic, sourced animal profiles',()=>{
  const n=boot();
  const results=n.buildItems([{
    count:22,taxon:{
      id:6930,name:'Anas platyrhynchos',rank:'species',iconic_taxon_name:'Aves',preferred_common_name:'Mallard',
      default_photo:{license_code:'cc-by',medium_url:'https://example.org/mallard.jpg',attribution:'A. Photographer'}
    }
  }],5);
  assert.equal(results.length,1);
  assert.equal(results[0].title,'Mallard');
  assert.match(results[0].text,/green head/);
  assert.match(results[0].image,/mallard.jpg/);
  assert.match(results[0].imageCredit,/A. Photographer/);
  assert.match(results[0].nature.known.diet,/seeds/);
  assert.match(results[0].meta,/5 km/);
});
test('no unlicensed photos are embedded',()=>{
  const n=boot();
  assert.equal(n.choosePhoto({license_code:'all-rights-reserved',url:'https://images.org/duck.jpg'}),null);
  assert.equal(n.choosePhoto({license_code:'cc-by',url:'javascript:alert(1)'}),null);
});
test('plants are not substituted when the user selects wildlife',()=>{
  const n=boot();
  const r=n.buildItems([{count:1,taxon:{id:1,name:'Poa annua',rank:'species',iconic_taxon_name:'Plantae'}}]);
  assert.equal(r.length,0);
});
