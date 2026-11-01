/* Basic map behavior tests without network or browser dependencies. */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = readFileSync(path.join(__dirname, '..', 'map.js'), 'utf8');

function boot(withLeaflet = true) {
  const listeners = {};
  const timeouts = [];
  const controls = {};
  for (const id of ['map-status', 'toggle-geology', 'locate']) {
    controls[id] = {
      textContent: '',
      disabled: false,
      attributes: {},
      classes: new Set(),
      setAttribute(key, value) { this.attributes[key] = value; },
      addEventListener(event, handler) { listeners[id + ':' + event] = handler; }
    };
    controls[id].classList = {
      add(name) { controls[id].classes.add(name); },
      remove(name) { controls[id].classes.delete(name); }
    };
  }
  const document = {
    getElementById(id) { return controls[id]; },
    createElement(tag) { return { tagName: tag, textContent: '' }; }
  };
  const layers = new Set();
  const map = {
    setView(coords, zoom) { this.center = coords; this.zoom = zoom; return this; },
    getCenter() { return { lat: this.center[0], lng: this.center[1] }; },
    getZoom() { return this.zoom; },
    invalidateSize() {},
    addLayer(layer) { layers.add(layer); },
    removeLayer(layer) { layers.delete(layer); },
    hasLayer(layer) { return layers.has(layer); }
  };
  function layer(kind) {
    return {
      kind,
      addTo(instance) { instance.addLayer(this); return this; },
      on(event, callback) { this.events ||= {}; this.events[event] = callback; return this; },
      bindPopup(value) { this.popup = value; return this; }
    };
  }
  const requests = [];
  const L = {
    map() { return map; },
    tileLayer(url, options) { requests.push({ type: 'street', url, options }); return layer('street'); },
    circleMarker() { return layer('marker'); },
    circle() { return layer('accuracy'); },
    control: {
      zoom() { return { addTo() {} }; },
      scale() { return { addTo() {} }; }
    }
  };
  L.tileLayer.wms = (url, options) => {
    requests.push({ type: 'wms', url, options });
    return layer('wms');
  };
  const window = { L: withLeaflet ? L : undefined };
  vm.runInNewContext(source, { document, window, L, setTimeout: fn => { timeouts.push(fn); return timeouts.length; }, clearTimeout: () => {} });
  return { window, map, layers, requests, controls, listeners, timeouts };
}

test('initial map is a Lund example with OpenStreetMap plus configured SGU WMS', () => {
  const app = boot();
  assert.equal(Number(app.map.center[0].toFixed(4)), 55.7047);
  assert.equal(Number(app.map.center[1].toFixed(4)), 13.1910);
  assert.equal(app.requests[0].type, 'street');
  assert.match(app.requests[0].url, /tile\.openstreetmap\.org/);
  const wms = app.requests.find(request => request.type === 'wms');
  assert.match(wms.url, /resource\.sgu\.se\/service\/wms\/130\/jordarter-25-100-tusen/);
  assert.equal(wms.options.layers, 'jord:SE.GOV.SGU.JORD.GRUNDLAGER.25K');
  assert.equal(wms.options.version, '1.3.0');
  assert.equal(wms.options.format, 'image/png');
  assert.equal(wms.options.transparent, true);
  assert.equal(app.layers.size, 1);
});

test('geology toggle adds and removes the real layer with accessible pressed state', () => {
  const app = boot();
  const button = app.controls['toggle-geology'];
  app.listeners['toggle-geology:click']();
  assert.equal(button.attributes['aria-pressed'], 'true');
  assert.ok([...app.layers].some(layer => layer.kind === 'wms'));
  app.listeners['toggle-geology:click']();
  assert.equal(button.attributes['aria-pressed'], 'false');
  assert.ok(![...app.layers].some(layer => layer.kind === 'wms'));
});

test('selected GPS position recenters and accuracy marker is removed with location', () => {
  const app = boot();
  app.window.HereNowMap.setLocation({
    lat: 55.72, lon: 13.2, name: '<img src=x onerror=alert(1)>', accuracy: 35
  }, { zoom: 15 });
  assert.equal(app.map.zoom, 15);
  assert.equal(app.map.center[0], 55.72);
  assert.equal(app.map.center[1], 13.2);
  const marker = [...app.layers].find(layer => layer.kind === 'marker');
  assert.equal(marker.popup.textContent, '<img src=x onerror=alert(1)>');
  assert.ok([...app.layers].some(layer => layer.kind === 'accuracy'));
  app.window.HereNowMap.clearLocation();
  assert.ok(![...app.layers].some(layer => layer.kind === 'marker'));
  assert.ok(![...app.layers].some(layer => layer.kind === 'accuracy'));
});

test('missing Leaflet gracefully disables overlay without crashing discovery', () => {
  const app = boot(false);
  assert.equal(app.controls['toggle-geology'].disabled, true);
  assert.match(app.controls['map-status'].textContent, /could not load/i);
});

test('slow SGU WMS gets a human-readable status instead of infinite Loading', () => {
  const app = boot();
  app.listeners['toggle-geology:click']();
  assert.match(app.controls['map-status'].textContent, /Loading SGU/);
  app.timeouts[0]();
  assert.match(app.controls['map-status'].textContent, /has not returned map images/);
});
