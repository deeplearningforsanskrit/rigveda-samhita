const CACHE_NAME = 'rigveda-v1.1';

// All paths are relative to the location of sw.js
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  "./style.css",
  "./rigveda.json",
  "./app.js"
  // Add your specific css, js, or json data paths below:
  // './css/style.css',
  // './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Serve from cache if available, otherwise fetch from GitHub network
      return cachedResponse || fetch(event.request);
    })
  );
});