// web/public/sw.js
// Light — PWA service worker
// Handles: offline app-shell caching, runtime caching, Web Push notifications.

const CACHE_VERSION = 'light-v1';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Minimal app-shell. Vite's hashed build assets are added at runtime via the
// fetch handler below (cache-as-you-go), so we don't hardcode JS/CSS bundle
// filenames here — they change every build.
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('light-') && key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Strategy:
// - Navigation requests (HTML): network-first, fallback to cached shell (offline support)
// - Static assets (JS/CSS/images/fonts): stale-while-revalidate
// - API calls (/api/*): network-only, never cache (avoid serving stale chat data)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Never cache API/WS traffic
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Navigation requests — network-first so users always get fresh HTML when online
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets — stale-while-revalidate
  event.respondWith(
    caches.open(RUNTIME_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});

// ---------------------------------------------------------------------------
// Web Push — incoming notifications (new message, incoming call)
// ---------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let payload = { title: 'Light', body: 'You have a new notification.' };

  try {
    if (event.data) payload = event.data.json();
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  const isCall = payload.type === 'incoming_call';

  const options = {
    body: payload.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    tag: payload.tag || (isCall ? `call-${payload.callId}` : undefined),
    requireInteraction: isCall, // keep call notifications on screen until acted on
    vibrate: isCall ? [200, 100, 200, 100, 200] : [100],
    data: payload.data || {},
    actions: isCall
      ? [
          { action: 'accept', title: 'Accept' },
          { action: 'decline', title: 'Decline' },
        ]
      : undefined,
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';
  const action = event.action; // 'accept' | 'decline' | '' (body click)

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'notification-action', action, data: event.notification.data });
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
