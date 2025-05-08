// Service worker for Algorithmic Art Gallery
const CACHE_NAME = 'algorithmic-art-cache-v2';

// Assets to cache
const STATIC_ASSETS = [
  '/',
  '/gallery',
  '/about',
  '/fonts/NebulaSans-Book.ttf',
  '/fonts/NebulaSans-BoldItalic.ttf',
  '/icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json'
];

// Install event - cache static assets with improved error handling
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Use map + Promise.allSettled instead of addAll to continue even if some files are missing
        return Promise.allSettled(
          STATIC_ASSETS.map(url => 
            fetch(new Request(url), { cache: 'no-store' })
              .then(response => {
                if (!response.ok) {
                  throw new Error(`Failed to fetch ${url}`);
                }
                return cache.put(url, response);
              })
              .catch(error => {
                console.warn(`Caching failed for ${url}:`, error);
                // Continue despite the error
                return Promise.resolve();
              })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fetch from network for non-cached assets
self.addEventListener('fetch', event => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip for worker files that need direct access
  if (event.request.url.includes('/worker/color-mapper.js')) return;
  
  // Handle JSON parsing errors by always fetching manifest.json from network
  if (event.request.url.includes('manifest.json')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response if found
        if (response) {
          return response;
        }
        
        // Clone the request - request can only be used once
        const fetchRequest = event.request.clone();
        
        // Try to fetch from network
        return fetch(fetchRequest)
          .then(response => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response - response can only be used once
            const responseToCache = response.clone();
            
            // Cache the new file for future use
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              })
              .catch(err => console.warn('Cache put error:', err));
              
            return response;
          })
          .catch(error => {
            console.warn('Fetch failed:', error);
            // For navigation requests, return the offline page
            if (event.request.mode === 'navigate') {
              return caches.match('/');
            }
            
            // Otherwise just let the error happen
            throw error;
          });
      })
  );
}); 