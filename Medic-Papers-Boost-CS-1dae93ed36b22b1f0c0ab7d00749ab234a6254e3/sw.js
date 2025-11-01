// This service worker's sole purpose is to intercept requests for .ts/.tsx files
// and serve them with the correct JavaScript MIME type, bypassing server misconfigurations.

// On install, activate immediately.
self.addEventListener('install', event => {
  console.log('[SW] Install: Activating immediately.');
  // Force the waiting service worker to become the active service worker.
  event.waitUntil(self.skipWaiting());
});

// On activation, claim all open clients.
self.addEventListener('activate', event => {
  console.log('[SW] Activate: Claiming clients.');
  // This makes the service worker take control of the page immediately.
  event.waitUntil(self.clients.claim());
});

// On fetch, intercept requests for .ts/.tsx files and fix their MIME type.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // We only intercept requests for local .ts/.tsx files.
  if (url.origin === self.location.origin && (url.pathname.endsWith('.ts') || url.pathname.endsWith('.tsx'))) {
    
    console.log(`[SW] Intercepting fetch for: ${url.pathname}`);
    
    event.respondWith(
      fetch(event.request).then(response => {
        // If the fetch fails, just return the failed response.
        if (!response.ok) {
          console.error(`[SW] Fetch failed for ${url.pathname}: ${response.statusText}`);
          return response;
        }
        
        // Create new headers, set the correct Content-Type, and add aggressive cache-busting headers.
        const headers = new Headers(response.headers);
        headers.set('Content-Type', 'application/javascript; charset=utf-8');
        headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        headers.set('Pragma', 'no-cache');
        headers.set('Expires', '0');
        
        console.log(`[SW] Serving corrected MIME type (non-cached) for: ${url.pathname}`);
        
        // Return a new response with the corrected headers and original body.
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: headers
        });
      }).catch(error => {
        console.error(`[SW] Network error for ${url.pathname}:`, error);
        // On network error, return an informative error response.
        return new Response(`Service Worker network error for ${url.pathname}`, {
          status: 500,
          statusText: 'Service Worker Fetch Error'
        });
      })
    );
  }
  // For all other requests, do nothing and let the browser handle them normally.
});