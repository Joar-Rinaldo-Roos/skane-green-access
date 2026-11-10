const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const test=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'..','soil-info.js'),'utf8');
function boot(){
  const window={};
  const document={createElement:tag=>({tagName:tag,children:[],appendChild(c){this.children.push(c);},set textContent(v){this._text=v;},get textContent(){return this._text;}})};
  vm.runInNewContext(source,{window,document});
  return window.HereNowSoil;
}
test('Moränfinlera is English clay-rich glacial till with SGU-defined clay share',()=>{
  const s=boot().explain('Moränfinlera');
  assert.match(s.title,/clay-rich glacial till/i);
  assert.match(s.material,/25% clay/);
  assert.ok(s.questions.length>=3);
});
test('Fyllning is man-made fill, with original label preserved',()=>{
  const s=boot().explain('Fyllning');
  assert.match(s.title,/artificial fill/i);
  assert.match(s.material,/material placed here by people/i);
  assert.equal(s.original,'Fyllning');
});
test('Bedrock is distinguished from the soil map and mineral species not invented',()=>{
  const s=boot().explain('Berg');
  assert.match(s.title,/bedrock/i);
  assert.match(s.meaning,/bedrock map/i);
});
test('Expandable source-backed card never injects the untrusted SGU category as HTML',()=>{
  const s=boot().createCard('<img src=x onerror=alert(1)>');
  const inner=s.children.find(c=>c.className==='soil-swedish');
  assert.equal(inner.textContent,'SGU label: <img src=x onerror=alert(1)>');
  assert.ok(s.children.some(c=>c.tagName==='details'));
  assert.ok(s.children.some(c=>c.tagName==='a'));
});
