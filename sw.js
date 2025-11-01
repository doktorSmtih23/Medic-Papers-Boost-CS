const CACHE_NAME = 'medic-papers-boost-cs-cache-v3'; // Version bump to trigger update
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  // Dependencies
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.min.mjs',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  // Main app files for offline capability
  './index.tsx',
  './App.tsx',
  './types.ts',
  './components/Home.tsx',
  './components/FileUpload.tsx',
  './components/SummaryView.tsx',
  './components/QuizView.tsx',
  './components/FlashcardsView.tsx',
  './components/LoadingSpinner.tsx',
  './components/LibraryView.tsx',
  './services/geminiService.ts',
  './services/libraryService.ts',
];

// On install, cache the app shell and immediately activate.
self.addEventListener('install', event => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(URLS_TO_CACHE).catch(err => {
            console.error('[SW] Caching failed for some resources:', err);
        });
      })
      .then(() => {
        console.log('[SW] Skip waiting');
        // Force the waiting service worker to become the active service worker.
        return self.skipWaiting();
      })
  );
});

// On activation, claim clients and clean up old caches.
self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    self.clients.claim().then(() => {
        // This makes the service worker take control of existing clients.
        console.log('[SW] Clients claimed');
        return caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        });
    })
  );
});

// On fetch, intercept requests.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // For TS/TSX files, fetch from network and fix the MIME type.
  if (url.pathname.endsWith('.ts') || url.pathname.endsWith('.tsx')) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (!response.ok) {
          console.error(`[SW] Fetch failed for ${url.pathname}: ${response.statusText}`);
          return response;
        }
        
        const headers = new Headers(response.headers);
        headers.set('Content-Type', 'application/javascript');
        
        console.log(`[SW] Serving corrected MIME type for: ${url.pathname}`);
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: headers
        });
      }).catch(error => {
        console.error(`[SW] Network error for ${url.pathname}:`, error);
        return new Response(`Network error for ${url.pathname}`, {
          status: 500,
          statusText: 'Service Worker Fetch Error'
        });
      })
    );
    return; // End execution here for these files.
  }

  // For all other requests, use a "cache-first" strategy.
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
