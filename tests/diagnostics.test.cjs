const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('diagnostics library is loaded before app scripts and deployed', () => {
  const html = root('index.html');
  assert.ok(html.indexOf('diagnostics.js') < html.indexOf('map.js'));
  for(const id of ['diagnostics-output','copy-diagnostics','check-diagnostics','map-mode']) {
    assert.ok(html.includes('id="' + id + '"'));
  }
  assert.match(root('.github/workflows/pages.yml'), /cp .*diagnostics\.js/);
});

test('discovery can use map center without GPS and does not always reacquire GPS', () => {
  const app = root('app.js');
  assert.match(app, /function chooseMapCenter/);
  assert.match(app, /mode==='gps'\)\{if\(!location\)location=await gps\(\)/);
  assert.match(app, /mode==='map'\)/);
  assert.match(app, /HereNowDiagnostics/);
});
