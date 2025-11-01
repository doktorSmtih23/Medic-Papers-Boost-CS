// This script now controls the loading of the main application
// to ensure the service worker is active before the app script is requested.

if ('serviceWorker' in navigator) {
  // This function creates and injects the main application script tag.
  const loadMainScript = () => {
    console.log('Attempting to load main application script...');
    // Avoid loading multiple times
    if (document.querySelector('script[src="./index.tsx"]')) {
      console.log('Main script already loaded or loading.');
      return;
    }
    const script = document.createElement('script');
    script.type = 'text/babel';
    script.setAttribute('data-type', 'module'); // For Babel to process as a module
    script.src = './index.tsx';
    script.onerror = () => {
        console.error("Fatal Error: The main application script failed to load.");
    };
    document.body.appendChild(script);
    console.log('Main application script tag injected.');
  };

  navigator.serviceWorker
    .register('./sw.js')
    .then(registration => {
      console.log('SW registration successful:', registration.scope);
      
      // The `ready` promise resolves when a service worker has become active
      // and is controlling the page. This is the perfect time to load our script.
      navigator.serviceWorker.ready.then(readyRegistration => {
        console.log('Service Worker is ready and controlling the page.', readyRegistration);
        loadMainScript();
      }).catch(readyError => {
        console.error('Service Worker .ready() promise failed:', readyError);
        // Even if ready fails, the worker might be active. Try loading anyway.
        loadMainScript();
      });
    })
    .catch(registrationError => {
      console.error('SW registration failed:', registrationError);
      // Fallback: if SW fails to register, try loading the script anyway.
      // It will likely fail with the same MIME error, but it's better than doing nothing.
      console.error('Attempting to load main script despite SW registration failure.');
      loadMainScript();
    });
} else {
  // If service workers aren't supported, we need to load the script directly.
  console.warn('Service Workers not supported. Loading main script directly.');
  const script = document.createElement('script');
  script.type = 'text/babel';
  script.setAttribute('data-type', 'module');
  script.src = './index.tsx';
  document.body.appendChild(script);
}