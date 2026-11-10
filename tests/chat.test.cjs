const fs=require('node:fs'),path=require('node:path'),test=require('node:test');
const assert=require('node:assert/strict');
const root=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('GPT chat is an optional panel under the globe',()=>{
  const html=root('index.html');
  assert.ok(html.indexOf('id="ask-panel"')>html.indexOf('id="map-title"'));
  assert.match(html,/chat.js\?v=11/);
  assert.match(html,/id="backend-token" type="password"/);
  assert.match(html,/id="ask-messages"/);
});
test('website is deployed without any local backend secret',()=>{
  const pages=root('.github/workflows/pages.yml');
  assert.match(pages,/cp .*chat\.js/);
  assert.doesNotMatch(pages,/cp .*backend\/server/);
  assert.doesNotMatch(pages,/cp .*\.env/);
  const ignore=root('.gitignore');
  assert.match(ignore,/backend\/\.env/);
});
test('chat queries use a separate access token and never expose the project key',()=>{
  const chat=root('chat.js'),app=root('app.js');
  assert.match(chat,/Authorization.*Bearer/);
  assert.doesNotMatch(chat,/OPENAI_API_KEY/);
  assert.match(app,/window\.HereNowAppContext/);
  assert.match(chat,/HereNowMap\?\.lookupSoilAt/);
});
