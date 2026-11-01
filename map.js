/* Phase 1: Leaflet street map + SGU OGC WMS imagery. No geological claims are inferred from pixels. */
(function () {
  'use strict';
  const statusEl = document.getElementById('map-status');
  const geologyButton = document.getElementById('toggle-geology');
  const findButton = document.getElementById('locate');
  let map = null;
  let marker = null;
  let accuracyCircle = null;
  let geologyLayer = null;
  let geologyHasError = false;

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function setLocation(place, options = {}) {
    if (!map || !Number.isFinite(place?.lat) || !Number.isFinite(place?.lon)) return;
    const point = [place.lat, place.lon];
    if (marker) map.removeLayer(marker);
    if (accuracyCircle) map.removeLayer(accuracyCircle);
    marker = L.circleMarker(point, {
      radius: 9, weight: 3, color: '#fff', fillColor: '#176b50', fillOpacity: 1
    }).addTo(map).bindPopup(place.name || 'Selected location');
    if (Number.isFinite(place.accuracy) && place.accuracy > 0 && place.accuracy < 10000) {
      accuracyCircle = L.circle(point, {
        radius: place.accuracy, color: '#176b50', fillColor: '#176b50',
        fillOpacity: 0.08, weight: 1
      }).addTo(map);
    } else {
      accuracyCircle = null;
    }
    map.setView(point, options.zoom || 14, { animate: false });
    const precision = Number.isFinite(place.accuracy) ? ' (GPS accuracy ≈' + Math.round(place.accuracy) + ' m)' : '';
    setStatus('Showing ' + (place.name || 'selected location') + precision + '. Pan or zoom to explore.');
  }

  function clearLocation() {
    if (!map) return;
    if (marker) map.removeLayer(marker);
    if (accuracyCircle) map.removeLayer(accuracyCircle);
    marker = null;
    accuracyCircle = null;
    setStatus('Choose a place or tap Find me to mark a location.');
  }

  function showGeology(enabled) {
    if (!map || !geologyLayer) {
      setStatus('Map service unavailable. Check your connection and reload.');
      return;
    }
    geologyHasError = false;
    if (enabled) {
      if (!map.hasLayer(geologyLayer)) geologyLayer.addTo(map);
      geologyButton.classList.add('layer-active');
      geologyButton.setAttribute('aria-pressed', 'true');
      geologyButton.setAttribute('aria-label', 'Hide SGU soil geology map layer');
      setStatus('Loading SGU soil geology map…');
    } else {
      if (map.hasLayer(geologyLayer)) map.removeLayer(geologyLayer);
      geologyButton.classList.remove('layer-active');
      geologyButton.setAttribute('aria-pressed', 'false');
      geologyButton.setAttribute('aria-label', 'Show SGU soil geology map layer');
      setStatus('Street map showing. Soil geology overlay hidden.');
    }
  }

  window.HereNowMap = { setLocation, clearLocation, showGeology, setStatus };

  if (!window.L) {
    geologyButton.disabled = true;
    setStatus('The map library could not load. Check your connection and reload; discovery still works.');
    return;
  }

  try {
    // Lund is a neutral starting view. This is NOT the user's GPS location.
    map = L.map('map', { zoomControl: false, scrollWheelZoom: false }).setView([55.7047, 13.1910], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    // Source: SGU Jordarter 1:25 000–1:100 000 WMS 1.3.0;
    // named layer and EPSG:3857 support documented by SGU.
    geologyLayer = L.tileLayer.wms('https://resource.sgu.se/service/wms/130/jordarter-25-100-tusen', {
      layers: 'jord:SE.GOV.SGU.JORD.GRUNDLAGER.25K',
      version: '1.3.0',
      format: 'image/png',
      transparent: true,
      opacity: 0.73,
      attribution: '&copy; <a href="https://www.sgu.se/">SGU</a>'
    });
    geologyLayer.on('tileerror', function () {
      geologyHasError = true;
      if (map.hasLayer(geologyLayer)) {
        setStatus('Some SGU map tiles could not load. Try zooming out or turn off Soil geology.');
      }
    });
    geologyLayer.on('load', function () {
      if (map.hasLayer(geologyLayer) && !geologyHasError) {
        setStatus('SGU soil geology overlay loaded. Colors indicate mapped soil units, not verified point measurements.');
      }
    });
    geologyButton.addEventListener('click', function () {
      showGeology(!map.hasLayer(geologyLayer));
    });
  } catch (error) {
    geologyButton.disabled = true;
    findButton.disabled = false;
    setStatus('Unable to initialize the map. Discovery can still be used.');
  }
})();
