// sw.js - קאשינג בסיסי ל־offline + Push Notifications
const CACHE_NAME = 'gsh-cache-v2';
const ASSETS = [
  '/', '/index.html',
  '/GSH.png', '/GSH-192.png', '/GSH-512.png',
  '/buy.png', '/cat.png', '/add.png'
  // Note: External CDN resources (Tailwind, Chart.js) are loaded via script tags
  // and don't need to be cached by service worker due to CORS restrictions
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache assets that don't have CORS restrictions
      return Promise.allSettled(
        ASSETS.map(asset => 
          cache.add(asset).catch(err => {
            console.warn(`Failed to cache ${asset}:`, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => {
        if (k !== CACHE_NAME) {
          console.log('Deleting old cache:', k);
          return caches.delete(k);
        }
        return null;
      }))
    )
  );
  // Force take control immediately
  self.clients.claim();
  // Force skip waiting
  self.skipWaiting();
});

// Network-first עם נפילה ל־cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Cache images aggressively
  if(request.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if(cached) return cached;
        return fetch(request).then((resp) => {
          if(resp.ok) {
            const respClone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, respClone)).catch(()=>{});
          }
          return resp;
        }).catch(() => {
          // Return placeholder if fetch fails
          return caches.match('/buy.png').then((placeholder) => placeholder || new Response('', {status: 404}));
        });
      })
    );
    return;
  }
  
  // For other resources, network-first
  event.respondWith(
    fetch(request)
      .then((resp) => {
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
