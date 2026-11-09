/* MapLibre GL v6 ships ES modules, not a classic maplibre-gl.js bundle.
   Load independently so failures never prevent GPS or discoveries from starting. */
window.HereNowGlobeLoader = { state: 'loading' };
try {
  const maplibregl = await import('https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs');
  window.maplibregl = maplibregl;
  window.HereNowGlobeLoader.state = 'ready';
  window.HereNowDiagnostics?.log('Globe', 'MapLibre v6 ES module loaded');
} catch (error) {
  window.HereNowGlobeLoader.state = 'error';
  window.HereNowDiagnostics?.log('Globe', 'MapLibre module failed: ' + (error?.message || 'unknown load error'));
}
