// sw.js
// The local fallback version name — only used when offline and no prior cache exists.
// When online, the authoritative version is always fetched from version.json.
const FALLBACK_CACHE_NAME = 'rigveda-v4';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './rigveda.json',
  './app.js',
  './version.json'
];

// ─── INSTALL ────────────────────────────────────────────────────────────────
// Minimal install: just activate as fast as possible.
// Actual caching happens in activate after we know the correct version name.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ─── ACTIVATE ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const targetVersion = await fetchRemoteVersion();
      console.log('[SW] Target cache version:', targetVersion);

      // Delete every cache bucket that doesn't match the target version
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((name) => {
          if (name !== targetVersion) {
            console.log('[SW] Deleting stale cache:', name);
            return caches.delete(name);
          }
        })
      );

      // Pre-cache all assets under the correct version name
      const cache = await caches.open(targetVersion);
      try {
        await cache.addAll(ASSETS_TO_CACHE);
        console.log('[SW] Assets cached under:', targetVersion);
      } catch (err) {
        console.warn('[SW] Pre-cache failed (possibly offline):', err);
      }

      // Take control of all open tabs immediately
      await self.clients.claim();
    })()
  );
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  // Only handle same-origin GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const targetVersion = await fetchRemoteVersion();
      const cache = await caches.open(targetVersion);

      // version.json: always network-first so we always have the latest signal
      if (event.request.url.includes('version.json')) {
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            await cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          return (await cache.match(event.request)) || Response.error();
        }
      }

      // All other assets: cache-first, fall back to network
      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse.ok) {
          await cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch {
        return Response.error();
      }
    })()
  );
});

// ─── MESSAGE: manual update trigger from the page ────────────────────────────
// The page can post { type: 'CHECK_UPDATE' } to force an immediate re-check.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CHECK_UPDATE') {
    // Invalidate the in-memory version cache so next fetch re-reads version.json
    cachedVersion = null;
    console.log('[SW] Manual update check triggered');
    event.source?.postMessage({ type: 'UPDATE_CHECK_STARTED' });
  }
});

// ─── VERSION CACHE (in-memory, per SW lifetime) ──────────────────────────────
// We cache the fetched version in memory so we don't hammer the network on
// every single fetch event. It resets each time the SW restarts (page reload).
let cachedVersion = null;

async function fetchRemoteVersion() {
  if (cachedVersion) return cachedVersion;

  try {
    // cache: 'no-store' ensures we bypass the HTTP cache and hit the network
    const res = await fetch('./version.json', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json?.cache_version) {
        cachedVersion = json.cache_version;
        return cachedVersion;
      }
    }
  } catch {
    // Offline or fetch failed — fall back gracefully
  }

  // If we can't reach the network, try to find whichever cache we already have
  const existingCaches = await caches.keys();
  if (existingCaches.length > 0) {
    cachedVersion = existingCaches[0]; // use whatever is already there
    return cachedVersion;
  }

  cachedVersion = FALLBACK_CACHE_NAME;
  return cachedVersion;
}