const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test');
const src=fs.readFileSync(path.join(__dirname,'..','local-history.js'),'utf8');
function boot(){
 const window={HereNowDiagnostics:{log(){}}};
 vm.runInNewContext(src,{window});
 return window.HereNowLocalHistory;
}
test('hospital district includes well-sourced history and original photo links',()=>{
 const h=boot().discover({lat:55.71176,lon:13.19868});
 assert.ok(h.length>=2);
 assert.match(h[0].text,/1768/);
 assert.match(h[0].text,/two beds/);
 assert.ok(h.some(s=>s.extraLinks?.some(l=>l.url.includes('medicinhistoriskasyd.se'))));
 assert.match(h[0].meta,/district|building/i);
});
test('hospital facts do not appear for a different town',()=>{
 assert.equal(boot().discover({lat:55.6,lon:13.0}).length,0);
});
