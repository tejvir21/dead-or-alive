/**
 * public/sw.js — Service Worker for Web Push
 * Vite serves files in /public at the site root, so this is reachable at
 * /sw.js — register it from there (see src/utils/pushClient.js).
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (err) {
    payload = { title: 'Dead or Alive', body: event.data.text() };
  }

  const title = payload.title || 'Dead or Alive';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'general',
    data: { url: payload.url || '/lobby' },
    // Renotify so a repeated tag (e.g. multiple game-start pings) still
    // alerts the user instead of silently replacing a dismissed one
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Clicking the notification focuses an existing tab if one's open,
// otherwise opens a new one — either way, navigates to the relevant page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/lobby';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
