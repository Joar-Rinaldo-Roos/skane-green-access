const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test');
const src=fs.readFileSync(path.join(__dirname,'..','soil-info.js'),'utf8');
function boot(){
  const nodes={};
  const element=tag=>({
    tagName:tag,children:[],events:{},attrs:{},
    appendChild(v){this.children.push(v);},replaceChildren(){this.children=[];},
    addEventListener(n,fn){this.events[n]=fn;},scrollIntoView(){this.scrolled=true;},
    set textContent(v){this._text=v;},get textContent(){return this._text;}
  });
  nodes['geology-details']=element('section');
  nodes['geology-details'].hidden=true;
  nodes['geology-details-content']=element('div');
  nodes['close-geology-details']=element('button');
  const document={createElement:element,getElementById:id=>nodes[id]};
  const window={};
  vm.runInNewContext(src,{window,document});
  return {api:window.HereNowSoil,nodes};
}
test('the map popup contains only summary and a working Read more button',()=>{
  const {api,nodes}=boot();
  const popup=api.createSummary('Moränfinlera');
  assert.equal(popup.children[0].textContent,'Clay-rich glacial till');
  assert.ok(!popup.children.some(c=>c.textContent==='How did it get here?'));
  const button=popup.children.find(c=>c.tagName==='button');
  assert.ok(button.textContent.includes('Read more'));
  button.events.click();
  assert.equal(nodes['geology-details'].hidden,false);
  const table=nodes['geology-details-content'].children.find(c=>c.tagName==='table');
  assert.ok(table);
  assert.equal(table.children[0].children.length,3);
});
