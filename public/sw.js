
const CACHE_NAME = 'pharmaflow-v5-offline-persistence';
const OFFLINE_URL = '/index.html';

const ASSETS = [
  '/',
  '/index.html',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap',
  'https://esm.sh/dexie@^3.2.4',
  'https://esm.sh/zustand@^5.0.0'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .catch(err => console.error("[SW] Install failed asset caching:", err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key).catch(() => {});
      })
    )).catch(err => console.error("[SW] Activate cleanup failed:", err))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const isDev = self.location.hostname === 'localhost' || 
                self.location.hostname.includes('127.0.0.1') || 
                self.location.hostname.includes('ais-dev');
                
  if (isDev) {
    // Completely bypass caching in development to avoid stale preamble or cached bundle errors
    event.respondWith(fetch(event.request));
    return;
  }

  if (!event.request.url.startsWith(self.location.origin) && !ASSETS.includes(event.request.url)) {
     if (!ASSETS.some(asset => event.request.url.includes(asset))) {
        // Pass external
     }
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((response) => {
        return response || fetch(event.request).then(networkResponse => {
           return caches.open(CACHE_NAME).then(cache => {
             cache.put('/index.html', networkResponse.clone()).catch(() => {});
             return networkResponse;
           }).catch(() => networkResponse);
        }).catch(() => null);
      }).then(finalResponse => {
         return finalResponse || caches.match('/index.html');
      }).catch(() => {
         return caches.match('/index.html');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone()).catch(() => {});
          }).catch(() => {});
        }
        return networkResponse;
      }).catch(() => cachedResponse); 
      return cachedResponse || fetchPromise;
    }).catch(() => fetch(event.request).catch(() => null))
  );
});

/**
 * معالج المزامنة المؤجلة (Delayed Sync Handler)
 * يعمل عندما يعود الاتصال بالإنترنت
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'pharma-sync-task') {
    event.waitUntil(processBackgroundSync());
  }
});

async function processBackgroundSync() {
  console.log('[SW] Delayed Sync Triggered: Uploading offline content...');
  
  const clients = await self.clients.matchAll();
  
  // إبلاغ التطبيق ببدء المزامنة
  clients.forEach(client => {
    client.postMessage({ type: 'TRIGGER_SYNC' });
  });

  return Promise.resolve();
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clientList => {
      if (clientList.length > 0) return clientList[0].focus();
      return self.clients.openWindow('/');
    })
  );
});
