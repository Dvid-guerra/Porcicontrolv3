// Service Worker de Porcicontrol para operación en galpones sin señal móvil.
// Cachea el shell de la app y los bundles compilados (/assets/*) para abrir al instante offline.

const CACHE_NAME = 'porcicontrol-shell-v3';
const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/pwa-icon.svg',
  '/pwa-192.png',
  '/pwa-512.png',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('porcicontrol-shell-') && key !== CACHE_NAME)
          .map((oldKey) => caches.delete(oldKey))
      )
    )
  );
  self.clients.claim();
});

function esPeticionApiExterna(url) {
  const host = url.hostname;
  return (
    host.includes('googleapis.com') ||
    host.includes('firebaseio.com') ||
    host.includes('firebaseapp.com') ||
    host.includes('cloudfunctions.net') ||
    host.includes('recaptcha') ||
    host.includes('gstatic.com') && url.pathname.includes('recaptcha')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (esPeticionApiExterna(url)) return;

  // 1. Navegación HTML: Network-First con respaldo offline inmediato a index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html');
          return cached || caches.match('/');
        })
    );
    return;
  }

  // 2. Bundles con hash de Vite (/assets/*) y fuentes: Cache-First + guardado automático
  const esAssetInmutable =
    (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) ||
    url.hostname === 'fonts.gstatic.com';

  if (esAssetInmutable) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 3. Resto de archivos locales (iconos, manifest, CSS de fuentes): Stale-While-Revalidate
  if (url.origin === self.location.origin || url.hostname === 'fonts.googleapis.com') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});
