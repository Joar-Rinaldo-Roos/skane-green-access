'use strict';
// Regression test: a release must be identifiable from the actual HTML served by GitHub Pages.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('style.css','utf8');
const deploy=fs.readFileSync('.github/workflows/pages.yml','utf8');
const version=JSON.parse(fs.readFileSync('version.json','utf8'));

test('release identifier follows semantic versioning',()=>{
 assert.match(version.version,/^\d+\.\d+\.\d+$/);
 assert.equal(version.version,'1.0.2');
});

test('top-right page header visibly displays the same version as release manifest',()=>{
 assert.match(html,new RegExp('class="app-version"[^>]*data-app-version="'+version.version.replaceAll('.','\\.')+'"[^>]*>v'+version.version.replaceAll('.','\\.')+'<\\/span>'));
 assert.match(css,/\.header-meta\s*\{/);
 assert.match(css,/\.app-version\s*\{/);
 assert.match(html,/class="header-meta"/);
});

test('release exposes both temperature and rain forecast controls and scripts',()=>{
 assert.match(html,/id="toggle-temperature"/);
 assert.match(html,/temperature-layer\.js\?v=/);
 assert.match(html,/id="toggle-rain"/);
 assert.match(html,/rain-forecast\.js\?v=/);
 assert.match(html,/id="rain-hour"/);
 assert.match(html,/id="rain-play"/);
 assert.match(html,/id="next-rain-panel"/);
 assert.match(html,/id="next-rain-refresh"/);
 assert.match(html,/next-rain\.js\?v=/);
});

test('Pages deploys and verifies the exact version visible on the live site',()=>{
 assert.match(deploy,/node --test version\.test\.cjs/);
 assert.match(deploy,/version\.json/);
 assert.match(deploy,/data-app-version/);
 assert.match(deploy,/toggle-temperature/);
 assert.match(deploy,/toggle-rain/);
 assert.match(deploy,/next-rain-panel/);
 assert.match(deploy,/curl -fsSL/);
});
