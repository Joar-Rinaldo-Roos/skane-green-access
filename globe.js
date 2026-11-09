/* Optional world-scale globe, using OSM raster tiles and MapLibre GL JS.
 * The SGU WMS only appears on Leaflet's flat local map. */
(function () {
  'use strict';
  const button = document.getElementById('toggle-globe');
  const street = document.getElementById('map');
  const globeContainer = document.getElementById('globe-map');
  const geologyButton = document.getElementById('toggle-geology');
  const controller = window.HereNowMap;
  if (!button || !street || !globeContainer || !controller) return;

  let globeMap = null;
  let globeMarker = null;
  let currentPlace = null;
  let globeActive = false;
  let globeReady = false;

  function syncMarker() {
    if (!globeMap || !globeReady || !window.maplibregl) return;
    if (globeMarker) globeMarker.remove();
    globeMarker = null;
    if (currentPlace) {
      const dot = document.createElement('div');
      dot.className = 'globe-marker';
      dot.setAttribute('aria-label', currentPlace.name || 'Selected location');
      globeMarker = new maplibregl.Marker({ element: dot })
        .setLngLat([currentPlace.lon, currentPlace.lat])
        .addTo(globeMap);
    }
  }

  function toStreet() {
    globeActive = false;
    globeContainer.hidden = true;
    street.hidden = false;
    geologyButton.disabled = false;
    button.disabled = false;
    button.textContent = '🌐 Globe';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', 'Switch to a rotatable globe');
    controller.resize?.();
    controller.setStatus('Street map active. Toggle Soil geology to view SGU’s WMS layer.');
  }

  function failGlobe(message) {
    if (globeMap) {
      try { globeMap.remove(); } catch (_) { /* ignore cleanup errors */ }
      globeMap = null;
    }
    globeReady = false;
    toStreet();
    controller.setStatus(message);
  }

  function toGlobe() {
    if(!window.maplibregl){
      window.HereNowDiagnostics?.log('Globe','MapLibre script missing');
      const state = window.HereNowGlobeLoader?.state || 'loading';
      controller.setStatus(state === 'error'
        ? 'Globe library failed to download. See Diagnostics for details. Street map still works.'
        : 'Globe library is still loading. Try Globe again shortly.');
      return;
    }
    if(typeof maplibregl.supported==='function' && !maplibregl.supported()){
      window.HereNowDiagnostics?.log('Globe','WebGL unsupported / blocked');
      controller.setStatus('Globe cannot start: WebGL is unavailable. The street map will still work.');
      return;
    }
    globeActive = true;
    globeContainer.hidden = false;
    street.hidden = true;
    geologyButton.disabled = true;
    button.textContent = '🗺️ Street map';
    button.setAttribute('aria-pressed', 'true');
    button.setAttribute('aria-label', 'Return to the street map');
    controller.setStatus('Opening globe… Drag to rotate Earth, pinch or scroll to zoom.');

    if (globeMap) {
      globeMap.resize();
      return;
    }

    const local = controller.getView?.() || { lat: 55.7047, lon: 13.1910 };
    try {
      globeMap = new maplibregl.Map({
        container: 'globe-map',
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
        },
        center: [local.lon, local.lat],
        zoom: 1.5,
        minZoom: 0.5,
        maxZoom: 16,
        attributionControl: true
      });
      globeMap.on('style.load', function () {
        globeMap.setProjection({ type: 'globe' });
      });
      globeMap.on('load', function () {
        globeReady = true;
        button.disabled = false;
        syncMarker();
        if (globeActive) controller.setStatus('Globe ready. Drag to spin Earth; zoom in to examine a region.');
      });
      globeMap.on('error', function (event) {
        if (globeActive && !globeReady) {
          failGlobe('Globe map failed to load. Try again on Wi-Fi or use the street map.');
        }
      });
      // A failed CDN or renderer must not leave the user stuck in globe mode.
      button.disabled = false;
    } catch (error) {
      window.HereNowDiagnostics?.log('Globe','Renderer initialization failed: '+error.message);
      failGlobe('Your browser could not start the globe. The street map is still available.');
    }
  }

  button.addEventListener('click', function () {
    if (globeActive) toStreet();
    else toGlobe();
  });

  const oldSetLocation = controller.setLocation;
  controller.setLocation = function (place, options) {
    oldSetLocation(place, options);
    if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return;
    currentPlace = place;
    syncMarker();
    if (globeMap && globeActive) {
      globeMap.flyTo({ center: [place.lon, place.lat], zoom: 4 });
      controller.setStatus('Showing ' + (place.name || 'selected location') + ' on the globe. Pinch or drag to explore.');
    }
  };

  const oldClear = controller.clearLocation;
  controller.clearLocation = function () {
    oldClear();
    currentPlace = null;
    syncMarker();
  };

  const oldGeology = controller.showGeology;
  controller.showGeology = function (enabled) {
    if (enabled && globeActive) toStreet();
    oldGeology(enabled);
  };
})();
