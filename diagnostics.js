/* Local, privacy-conscious browser diagnostics for Here & Now. */
(function () {
  'use strict';
  const output = document.getElementById('diagnostics-output');
  const status = document.getElementById('copy-diagnostics-status');
  const entries = [];
  function safeResource(value) {
    try { const u = new URL(String(value), window.location.href); return u.hostname + u.pathname; }
    catch (_) { return 'unknown resource'; }
  }
  function log(area, detail) {
    const line = '[' + new Date().toLocaleTimeString() + '] ' +
      String(area).slice(0, 35) + ': ' + String(detail).slice(0, 320);
    entries.push(line);
    if (entries.length > 80) entries.shift();
    if (output) output.textContent = entries.join('\n');
  }
  window.HereNowDiagnostics = { log };
  window.addEventListener('error', function (event) {
    if (event.target !== window && (event.target?.src || event.target?.href)) {
      log('Resource failed', safeResource(event.target.src || event.target.href));
    } else {
      log('JavaScript error', (event.message || 'Unknown error') +
        (event.filename ? ' in ' + safeResource(event.filename) + ':' + event.lineno : ''));
    }
  }, true);
  window.addEventListener('unhandledrejection', function (event) {
    log('Promise error', event.reason?.message || 'Unhandled promise rejection');
  });
  async function checkBrowser() {
    log('Browser', window.isSecureContext ? 'HTTPS secure context' : 'Not HTTPS (GPS requires HTTPS)');
    log('Browser', navigator.geolocation ? 'Geolocation API available' : 'Geolocation API unavailable');
    if (navigator.permissions?.query) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        log('Location permission', permission.state);
      } catch (_) { log('Location permission', 'Unavailable in this browser'); }
    }
    log('Map', window.L ? 'Leaflet loaded' : 'Leaflet library missing');
    log('Globe', window.maplibregl ? 'MapLibre loaded' : 'MapLibre library missing');
    if (window.maplibregl && typeof maplibregl.supported === 'function') {
      try { log('Globe', maplibregl.supported() ? 'WebGL check passed' : 'WebGL unavailable'); }
      catch (_) { log('Globe', 'WebGL check could not run'); }
    }
    log('Checks', 'Finished (no GPS coordinates recorded)');
  }
  document.getElementById('check-diagnostics')?.addEventListener('click', checkBrowser);
  document.getElementById('copy-diagnostics')?.addEventListener('click', async function () {
    try {
      await navigator.clipboard.writeText(entries.join('\n'));
      status.textContent = 'Copied. Review the report before sharing.';
    } catch (_) {
      status.textContent = 'Copy was blocked. Select the report below and copy it manually.';
    }
  });
  log('Diagnostics', 'Active. Logs stay in this tab and omit precise coordinates.');
  checkBrowser();
})();