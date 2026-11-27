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
 assert.equal(version.version,'1.0.16');
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
 assert.match(html,/id="toggle-clouds"/);
 assert.match(html,/id="cloud-forecast-controls"/);
 assert.match(html,/id="cloud-play"/);
 assert.match(html,/id="cloud-hour"/);
 assert.match(html,/id="cloud-opacity"/);
 assert.match(html,/id="cloud-opacity-value"/);
 assert.match(html,/id="cloud-with-temperature"/);
 assert.match(html,/id="toggle-wind"/);
 assert.match(html,/id="wind-forecast-controls"/);
 assert.match(html,/id="wind-play"/);
 assert.match(html,/id="weather-play"/);
 assert.match(html,/id="weather-hour"/);
 assert.match(html,/id="weather-timeline"/);
 assert.match(html,/weather-timeline\.js\?v=/);
 assert.match(html,/weather-data-cache\.js\?v=/);
 assert.match(html,/globe-map-controller\.js\?v=/);
 assert.match(html,/tile-cache\.js\?v=/);
 assert.doesNotMatch(html,/id="tile-cache-extra"/);
 assert.match(html,/weather-prefetch\.js\?v=/);
 assert.match(html,/first-frame-preload\.js\?v=2/);
 assert.match(html,/temperature-layer\.js\?v=9/);
 assert.match(html,/rain-forecast\.js\?v=7/);
 assert.match(html,/cloud-cover\.js\?v=7/);
 assert.match(html,/wind-layer\.js\?v=5/);
 assert.match(html,/diagnostics\.js\?v=6/);
 assert.match(html,/id="weather-first-frames-status"/);
 assert.match(html,/id="weather-prefetch-status"/);
 assert.doesNotMatch(html,/leaflet@/);
 assert.doesNotMatch(html,/id="toggle-globe"/);
 assert.equal((html.match(/class="legacy-weather-controls" hidden aria-hidden="true"/g)||[]).length,3);
 assert.match(html,/wind-layer\.js\?v=/);
 assert.match(html,/cloud-cover\.js\?v=/);
 assert.match(html,/next-rain\.js\?v=/);
});

test('Pages deploys and verifies the exact version visible on the live site',()=>{
 assert.match(deploy,/node --test version\.test\.cjs/);
 assert.match(deploy,/version\.json/);
 assert.match(deploy,/data-app-version/);
 assert.match(deploy,/toggle-temperature/);
 assert.match(deploy,/toggle-rain/);
 assert.match(deploy,/next-rain-panel/);
 assert.match(deploy,/toggle-clouds/);
 assert.match(deploy,/cloud-opacity/);
 assert.match(deploy,/cloud-with-temperature/);
 assert.match(deploy,/toggle-wind/);
 assert.match(deploy,/weather-play/);
 assert.match(deploy,/weather-data-cache\.js/);
 assert.match(deploy,/tile-cache\.js/);
 assert.match(deploy,/weather-prefetch\.js/);
 assert.match(deploy,/first-frame-preload\.js/);
 assert.match(deploy,/globe-map-controller\.js/);
 assert.match(deploy,/curl -fsSL/);
});

test('map introduction is current and removed green-space feature stays absent',()=>{
 assert.match(html,/Explore the 3D globe or tap Find me to zoom to your location\./);
 assert.doesNotMatch(html,/duplicate 2D|toggle-green-spaces|green-status|green-spaces(?:-core)?\.js/);
 for(const path of ['globe.js','globe-map-controller.js','map.js']) assert.doesNotMatch(fs.readFileSync(path,'utf8'),/HereNowGreenSpaces/);
});

test('Earth and Sky modes and optional day/night controls are deployed',()=>{
 for(const id of ['view-earth','view-sky','earth-view','sky-view','toggle-day-night','day-night-status'])assert(html.includes('id="'+id+'"'));
 assert.match(html,/id="sky-view"[^>]*hidden/);
 assert.match(html,/day-night\.js\?v=3/);
 assert.match(deploy,/node --test day-night\.test\.cjs/);
});

test('both globe appearances and realistic script are published',()=>{
 assert.match(html,/id="render-street"/);assert.match(html,/id="render-realistic"/);
 assert.match(html,/realistic-globe\.js\?v=2/);assert.match(deploy,/node --test realistic-globe\.test\.cjs/);
});

test('Realistic is selected by default and Deep space is deployed lazily',()=>{
 assert.match(html,/id="render-realistic"[^>]*aria-pressed="true"/);
 assert.match(html,/id="sky-deep-space"[^>]*aria-pressed="true"/);
 assert.match(html,/id="sky-my-sky"/);assert.match(html,/id="deep-space-atlas"/);
 assert.match(html,/deep-space\.js\?v=1/);assert.doesNotMatch(html,/src="https:\/\/aladin\.cds\.unistra\.fr\/AladinLite\/api/);
 assert.match(deploy,/node --test deep-space\.test\.cjs/);
});
