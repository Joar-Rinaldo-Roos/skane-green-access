/* Regression checks for Safari global property conflicts and MapLibre v6 CDN migration. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const file=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('app must not declare or reference the browser global location as state',()=>{
  const js=file('app.js');
  assert.match(js,/selectedLocation=null/);
  assert.doesNotMatch(js,/\b(?:let|const|var)\s+location\b/);
  assert.doesNotMatch(js,/\bif\s*\(\s*!location\s*\)/);
  assert.match(js,/'location-label'/);
  assert.match(js,/selectedLocation=await gps\(\)/);
});
test('MapLibre v6 loads as an ES module, not deleted classic UMD bundle',()=>{
  const html=file('index.html');
  const loader=file('globe-loader.mjs');
  assert.match(html,/<script type="module" src="\.\/globe-loader\.mjs\?v=6"><\/script>/);
  assert.doesNotMatch(html,/maplibre-gl@6\.16\.0\/dist\/maplibre-gl\.js/);
  assert.match(loader,/await import\('https:\/\/unpkg\.com\/maplibre-gl@6\.16\.0\/dist\/maplibre-gl\.mjs'\)/);
  assert.match(file('.github/workflows/pages.yml'),/cp .*globe-loader\.mjs/);
});
test('diagnostics and no-GPS map center remain in the page',()=>{
  assert.match(file('index.html'),/id="diagnostics-output"/);
  assert.match(file('index.html'),/id="map-mode"/);
  assert.match(file('app.js'),/function chooseMapCenter/);
});
