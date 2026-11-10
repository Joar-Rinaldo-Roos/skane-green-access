const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),test=require('node:test');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
test('geology popup is compact and deep details live outside map',()=>{
 const map=read('map.js'),globe=read('globe.js'),html=read('index.html'),soil=read('soil-info.js');
 assert.match(map,/HereNowSoil\?\.createSummary/);
 assert.match(globe,/HereNowSoil\?\.createSummary/);
 assert.match(soil,/function openDetails/);
 assert.match(soil,/geology-details-table/);
 assert.match(html,/id="geology-details"/);
 assert.match(html,/id="geology-details-content"/);
});
test('Culture removed; Nature and Astronomy have richer external modules',()=>{
 const app=read('app.js'),html=read('index.html');
 assert.doesNotMatch(html,/data-topic="culture"/);
 assert.doesNotMatch(app,/topic==='culture'/);
 for(const script of ['nature-detail.js','sky.js','local-history.js','discovery-ui.js']){
   assert.ok(html.includes(script));
   assert.ok(read('.github/workflows/pages.yml').includes(script));
 }
 assert.match(app,/HereNowNature\?\.buildItems/);
 assert.match(app,/HereNowSky/);
 assert.match(app,/HereNowLocalHistory/);
});
