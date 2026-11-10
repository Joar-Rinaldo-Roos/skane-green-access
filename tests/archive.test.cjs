const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const test=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'..','archive.js'),'utf8');
function boot(rows){
  const window={HereNowDiagnostics:{log(){}}};
  const fetch=async(url,opts)=>({ok:true,status:200,text:async()=>JSON.stringify({result:{records:{record:rows}}})});
  vm.runInNewContext(source,{window,URL,URLSearchParams,fetch,AbortController,
    setTimeout:()=>1,clearTimeout:()=>{}});
  return window.HereNowArchives;
}
test('archive query uses WGS84 bounding box and source metadata fields',()=>{
  const q=new URL(boot([]).buildUrl({lat:55.6,lon:13},75));
  assert.equal(q.hostname,'kulturarvsdata.se');
  assert.match(q.searchParams.get('query'),/^boundingBox=\/WGS84 "/);
  assert.equal(q.searchParams.get('recordSchema'),'xml');
  assert.match(q.searchParams.get('fields'),/thumbnail/);
});
test('only geocoded archive records inside the small radius survive filtering',async()=>{
  const archive=boot([
    {itemLabel:'An old street photo',lat:55.6001,lon:13,itemId:'raa/fmi/123',thumbnail:'https://source.example/thumb.jpg'},
    {itemLabel:'Too distant',lat:55.608,lon:13,itemId:'raa/fmi/124'},
    {itemLabel:'Missing coordinates',itemId:'raa/fmi/125'}
  ]);
  const records=await archive.search({lat:55.6,lon:13},75);
  assert.equal(records.length,1);
  assert.equal(records[0].name,'An old street photo');
  assert.ok(records[0].distanceMeters<20);
});
test('archive parser handles JSON recordSchema=xml response and safe URLs',()=>{
  const archive=boot([]);
  const records=archive.parseJson({result:{records:{record:[{itemLabel:'A building',lat:'55.6',lon:'13.0',url:'https://museum.example/1'}]}}});
  assert.equal(records[0].name,'A building');
  assert.equal(records[0].url,'https://museum.example/1');
});
