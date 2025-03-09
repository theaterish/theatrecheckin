// Cache name - change version when files change
const CACHE_NAME = 'theatre-checkin-v1';

// Files to cache
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/checkin.js',
  '/js/config.js',
  '/js/location.js',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return cacheNames.filter((cacheName) => !currentCaches.includes(cacheName));
    }).then((cachesToDelete) => {
      return Promise.all(cachesToDelete.map((cacheToDelete) => {
        return caches.delete(cacheToDelete);
      }));
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests like Firebase API calls
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Network-first strategy for HTML pages
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.open(CACHE_NAME)
          .then((cache) => {
            return cache.match('/offline.html');
          });
      })
    );
    return;
  }
  
  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then((response) => {
        // Don't cache responses that aren't successful
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        // Clone the response as it can only be consumed once
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      });
    })
  );
});

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    const notificationData = event.data.json();
    
    const options = {
      body: notificationData.body,
      icon: '/images/icon-192x192.png',
      badge: '/images/badge-96x96.png',
      data: notificationData.data
    };
    
    event.waitUntil(
      self.registration.showNotification(notificationData.title, options)
    );
  }
});

// Notification click event - handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = new URL('/', self.location.origin).href;
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      // Check if there is already a window open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
