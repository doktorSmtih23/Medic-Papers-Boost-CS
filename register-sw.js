// This script ensures the service worker is active and then triggers
// the loading of the main application script by setting its 'src' attribute.

if ('serviceWorker' in navigator) {
  const loadMainScript = () => {
    const mainScript = document.getElementById('main-app-script');
    // Check if the script exists, has a data-src, and doesn't have a src yet
    if (mainScript && mainScript.dataset.src && !mainScript.src) {
      console.log('[Loader] Service worker is ready. Triggering main application script load.');
      mainScript.src = mainScript.dataset.src;
      mainScript.onerror = () => {
        console.error("Fatal Error: The main application script failed to load. This might be due to a MIME type issue that the service worker couldn't fix, or a network problem.");
      };
    } else if (mainScript && mainScript.src) {
      console.log('[Loader] Main script already appears to be loaded or loading.');
    } else {
      console.error('[Loader] Main script tag with id "main-app-script" and a "data-src" attribute was not found.');
    }
  };

  navigator.serviceWorker
    .register('./sw.js')
    .then(registration => {
      console.log('[SW] Registration successful:', registration.scope);

      // The `ready` promise resolves when a service worker has become active
      // and is controlling the page. This is the perfect time to load our script.
      return navigator.serviceWorker.ready;
    })
    .then(readyRegistration => {
      console.log('[SW] Ready and controlling the page.', readyRegistration);
      loadMainScript();
    })
    .catch(error => {
      console.error('[SW] Service worker registration or ready promise failed:', error);
      // Fallback: if SW setup fails, try loading the script anyway.
      // It will likely fail with the same MIME error, but it's better than doing nothing.
      console.error('[Loader] Attempting to load main script despite service worker failure.');
      loadMainScript();
    });
} else {
  // Fallback for browsers that do not support Service Workers.
  console.warn('Service Workers not supported. Loading main script directly.');
  const mainScript = document.getElementById('main-app-script');
  if (mainScript && mainScript.dataset.src) {
    mainScript.src = mainScript.dataset.src;
  }
}
