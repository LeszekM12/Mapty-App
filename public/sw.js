const CACHE = 'mapty-v6.2';

const PRECACHE = [
  './',
  'index.html',
  'style.css',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'logo.png',

  // TS build
  'dist/main.js',
  'dist/models/Workout.js',
  'dist/modules/BottomNav.js',
  'dist/modules/MapView.js',
  'dist/modules/OfflineDetector.js',
  'dist/modules/RoutePlanner.js',
  'dist/modules/StatsPanel.js',
  'dist/modules/WeatherWidget.js',
  'dist/types/index.js',
  'dist/utils/dom.js',
  'dist/utils/geo.js',
  'dist/utils/db.js',
];

// INSTALL — pre-cache + AUTO-UPDATE
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())   // ← AUTO-UPDATE
  );
});

// ACTIVATE — clean old caches + TAKE CONTROL IMMEDIATELY
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())  // ← AUTO-UPDATE
  );
});

// FETCH — cache-first
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (url.protocol === 'chrome-extension:') return;
  if (e.request.method !== 'GET') return;

  // Always fetch external APIs live
  if (
    url.hostname.includes('tile.openstreetmap') ||
    url.hostname.includes('basemaps.cartocdn') ||
    url.hostname.includes('nominatim') ||
    url.hostname.includes('router.project-osrm') ||
    url.hostname.includes('api.open-meteo') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('fonts.googleapis') ||
    url.hostname.includes('bigdatacloud')
  ) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;

      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
