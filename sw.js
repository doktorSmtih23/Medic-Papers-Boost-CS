// A unique cache name is important for cache busting.
// Incrementing the version number will force the service worker to update
// and re-cache all essential application files.
const CACHE_NAME = 'medic-boost-cache-v2';

// Files that constitute the "app shell" - the minimal resources needed for the app to run.
const urlsToCache = [
  '/',
  './index.html',
  './index.tsx',
  './manifest.json'
];

// Event: install
// This is triggered when the service worker is first registered or when the file changes.
// It's used to cache the essential app shell files.
self.addEventListener('install', event => {
  console.log('[SW] Install: Caching app shell');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Activate the new service worker immediately
  );
});

// Event: activate
// This is triggered after the installation is successful.
// It's the perfect place to clean up old, outdated caches.
self.addEventListener('activate', event => {
  console.log('[SW] Activate: Cleaning up old caches');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // If a cache's name is not our current one, we delete it.
          if (cacheName !== CACHE_NAME) {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open clients immediately
  );
});

// Event: fetch
// This is triggered for every network request made by the page.
// We implement a "Network falling back to cache" strategy here.
self.addEventListener('fetch', event => {
  // We only cache GET requests. Other requests (POST, etc.) are passed through.
  if (event.request.method !== 'GET') {
      return;
  }
  
  event.respondWith(
    // 1. Try to fetch the resource from the network.
    fetch(event.request)
      .then(networkResponse => {
        // 2. If the network request is successful, we should cache the new response.
        return caches.open(CACHE_NAME).then(cache => {
          // We must clone the response because a response is a stream
          // and can only be consumed once. We need one for the cache and one for the browser.
          cache.put(event.request, networkResponse.clone());
          console.log(`[SW] Cached new version of: ${event.request.url}`);
          // 3. Return the original network response to the browser.
          return networkResponse;
        });
      })
      .catch(() => {
        // 4. If the network request fails (e.g., the user is offline),
        // we fall back to trying to serve the resource from the cache.
        console.log(`[SW] Network failed, serving from cache: ${event.request.url}`);
        return caches.match(event.request);
      })
  );
});
