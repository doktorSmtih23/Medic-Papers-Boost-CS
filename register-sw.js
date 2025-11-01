// This script ensures the service worker is active, then manually fetches,
// transforms (with Babel), and executes the main application script to
// avoid race conditions with Babel's automatic transformer.

if ('serviceWorker' in navigator && 'Babel' in window) {
  const loadAndRunMainScript = async () => {
    const mainScriptTag = document.getElementById('main-app-script');
    if (!mainScriptTag || !mainScriptTag.dataset.src) {
      console.error('[Loader] Main script tag with id "main-app-script" and "data-src" attribute was not found.');
      return;
    }
    
    const scriptUrl = mainScriptTag.dataset.src;

    try {
      console.log(`[Loader] Fetching main script content from: ${scriptUrl}`);
      // The fetch call will be intercepted by our service worker, which fixes the MIME type.
      const response = await fetch(scriptUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch script: ${response.status} ${response.statusText}`);
      }
      const tsxCode = await response.text();
      console.log('[Loader] Script content fetched successfully.');

      console.log('[Loader] Transforming TSX code with Babel...');
      // Explicitly call Babel to transform the code from TSX to plain JavaScript.
      // The presets are crucial for this to work correctly with React and TypeScript syntax.
      const transformed = Babel.transform(tsxCode, {
        presets: ['react', 'typescript'],
        filename: 'index.tsx' // filename is helpful for better error messages
      });
      console.log('[Loader] Code transformed successfully.');
      
      // Create a new script element to execute the transformed code.
      // It MUST be a module script because our code uses 'import' statements.
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = transformed.code;
      
      document.body.appendChild(script);
      console.log('[Loader] Transformed script injected and executed.');

    } catch (error) {
      console.error("Fatal Error: Failed to load, transform, or execute the main application script.", error);
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
      // Execute the main logic.
      loadAndRunMainScript();
    })
    .catch(error => {
      console.error('[SW] Service worker registration or ready promise failed:', error);
      // Fallback: if SW setup fails, try loading the script anyway.
      // It might work on platforms that serve correct MIME types by default.
      console.error('[Loader] Attempting to load main script despite service worker failure.');
      loadAndRunMainScript();
    });
} else {
  // Fallback for browsers that do not support Service Workers or if Babel is missing.
  console.warn('Service Workers or Babel not supported. Attempting direct script load.');
  const mainScript = document.getElementById('main-app-script');
  if (mainScript && mainScript.dataset.src) {
    // This is a last-ditch effort and may fail with a MIME type error.
    const script = document.createElement('script');
    script.type = "text/babel"; // Let Babel try to auto-transform
    script.setAttribute('data-type', 'module');
    script.src = mainScript.dataset.src;
    document.body.appendChild(script);
  }
}