// sw.js - Enhanced caching with versioning and auto-update
// Update this version number whenever you deploy a new version
const CACHE_VERSION = '6'; // Incremented to force update
const CACHE_NAME = `gsh-cache-v${CACHE_VERSION}`;
const APP_VERSION = '1.0.2'; // Should match package.json version

// Assets that should be cached persistently (images, icons)
const PERSISTENT_ASSETS = [
  '/GSH.png', '/GSH-192.png', '/GSH-512.png',
  '/buy.png', '/cat.png', '/add.png', '/WCdark.png'
];

// Files that should always be fetched fresh (HTML, JS, CSS)
const ALWAYS_NETWORK = [
  '/index.html',
  '/sw.js',
  '.js',
  '.css'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker version', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Only cache persistent assets (images), not HTML/JS
      return Promise.allSettled(
        PERSISTENT_ASSETS.map(asset => 
          cache.add(asset).catch(err => {
            console.warn(`[SW] Failed to cache ${asset}:`, err);
          })
        )
      );
    }).then(() => {
      // Force immediate activation
      return self.skipWaiting();
    })
  );
  // Force immediate activation
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker version', CACHE_VERSION);
  event.waitUntil(
    Promise.all([
      // Delete ALL caches first (aggressive cache clearing)
      caches.keys().then(keys => {
        console.log('[SW] Found caches:', keys);
        return Promise.all(keys.map(k => {
          console.log('[SW] Deleting cache:', k);
          return caches.delete(k);
        }));
      }).then(() => {
        // Re-create the new cache
        return caches.open(CACHE_NAME);
      }),
      // Claim all clients immediately (force takeover)
      self.clients.claim(),
      // Notify all clients about the update
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: CACHE_VERSION,
            appVersion: APP_VERSION,
            forceReload: true
          });
        });
      })
    ])
  );
  // Force immediate activation without waiting
  self.clients.claim();
});

// Enhanced fetch handler with version-aware caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // IMPORTANT: Skip external URLs (CDNs, Firebase, etc.) - let browser handle them
  // Only intercept same-origin requests
  if (url.origin !== self.location.origin) {
    // Don't intercept external requests - let them pass through normally
    return;
  }
  
  // Always fetch HTML, JS, CSS from network (bypass cache for updates)
  const shouldAlwaysFetch = ALWAYS_NETWORK.some(pattern => {
    return url.pathname === pattern || url.pathname.endsWith(pattern);
  });
  
  if (shouldAlwaysFetch) {
    // Network-only for HTML/JS/CSS - always get fresh version
    event.respondWith(
      fetch(request, {
        cache: 'no-store' // Bypass HTTP cache (no custom headers for same-origin)
      }).catch(() => {
        // Only fall back to cache if network completely fails
        return caches.match(request);
      })
    );
    return;
  }
  
  // Cache images persistently (cache-first with network update)
  if(request.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        // Return cached image immediately if available
        if(cached) {
          // Update cache in background
          fetch(request).then((resp) => {
            if(resp.ok) {
              const respClone = resp.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, respClone)).catch(()=>{});
            }
          }).catch(() => {});
          return cached;
        }
        // If not cached, fetch and cache
        return fetch(request).then((resp) => {
          if(resp.ok) {
            const respClone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, respClone)).catch(()=>{});
          }
          return resp;
        }).catch(() => {
          // Return placeholder if fetch fails
          return caches.match('/GSH.png').then((placeholder) => placeholder || new Response('', {status: 404}));
        });
      })
    );
    return;
  }
  
  // For other same-origin resources, network-first with cache fallback
  event.respondWith(
    fetch(request, {
      cache: 'no-cache' // Always check network first
    })
      .then((resp) => {
        // Cache successful responses
        if(resp.ok) {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, respClone)).catch(()=>{});
        }
        return resp;
      })
      .catch(() => caches.match(request).then((c) => c || Promise.reject()))
  );
});

// Push Notifications - Handle both FCM and regular push
self.addEventListener('push', (event) => {
  let data = {};
  let title = 'תזכורת';
  let body = 'יש לך תזכורת';
  
  // Handle FCM messages
  if (event.data) {
    try {
      const payload = event.data.json();
      // FCM format
      if (payload.notification) {
        title = payload.notification.title || title;
        body = payload.notification.body || body;
        data = payload.data || {};
      } else {
        // Regular push format
        data = payload;
        title = data.title || title;
        body = data.body || body;
      }
    } catch (e) {
      // Text data
      try {
        data = JSON.parse(event.data.text());
        title = data.title || title;
        body = data.body || body;
      } catch (e2) {
        title = event.data.text() || title;
      }
    }
  }
  
  const options = {
    body: body,
    icon: '/GSH-192.png',
    badge: '/GSH-192.png',
    tag: data.tag || 'reminder',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: data,
    actions: data.actions || []
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data || {};
  const urlToOpen = data.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus existing window
      for (let client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
